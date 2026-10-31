import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { initializeApp, cert, getApps } from "npm:firebase-admin@11.11.0/app"
import { getMessaging } from "npm:firebase-admin@11.11.0/messaging"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Firebase Admin globally
const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
if (serviceAccountStr && getApps().length === 0) {
  try {
    const serviceAccount = JSON.parse(serviceAccountStr)
    initializeApp({ credential: cert(serviceAccount) })
  } catch (error) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON")
  }
}

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse incoming request (action: 'cron_sweep' or 'send_immediate')
    const reqData = await req.json().catch(() => ({}))
    const { action = 'cron_sweep', log_id } = reqData

    // 2. Fetch PENDING records based on the mode
    // Fetch dynamic batch limit and routing preference from setup table
    const { data: setupData } = await supabase.from('setup').select('key, value').in('key', ['CRON_BATCH_SIZE_SEND_ALERT', 'WA_ROUTING_PREFERENCE'])
    
    let batchLimit = 50
    let routingPref = 'MAX_REACH'

    if (setupData) {
        const limitRow = setupData.find(r => r.key === 'CRON_BATCH_SIZE_SEND_ALERT')
        if (limitRow?.value) batchLimit = parseInt(limitRow.value, 10)
        
        const prefRow = setupData.find(r => r.key === 'WA_ROUTING_PREFERENCE')
        if (prefRow?.value) routingPref = prefRow.value.trim().toUpperCase()
    }

    let query = supabase
      .from('notification_logs')
      .select('*')
      .eq('status', 'PENDING')
      .lte('scheduled_for', new Date().toISOString())
      .is('locked_at', null)
      .limit(batchLimit) // Batch limit for Cron to prevent timeouts

    // If 'send_immediate' is triggered from the frontend, target only that exact log
    if (action === 'send_immediate' && log_id) {
      query = supabase.from('notification_logs').select('*').eq('id', log_id).eq('status', 'PENDING')
    }

    const { data: pendingLogs, error: fetchError } = await query
    
    if (fetchError) throw new Error(`Database error fetching logs: ${fetchError.message}`)
    if (!pendingLogs || pendingLogs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No pending notifications to process.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 3. Lock the records immediately (Mark as PROCESSING)
    const logIds = pendingLogs.map(l => l.id)
    await supabase.from('notification_logs')
      .update({ status: 'PROCESSING', locked_at: new Date().toISOString() })
      .in('id', logIds)

    let processedCount = 0

    // 4. Iterate and Dispatch
    for (const log of pendingLogs) {
      const { id, cpn_no, target_channels = [], raw_payload = {} } = log
      
      let finalStatus = 'SUCCESS'
      let finalCost = 0.00
      let errors: string[] = []
      let push_delivered = false // Tracker for COST_SAVER logic

      // Fetch latest customer contact details
      const { data: customer } = await supabase.from('ac_customers').select('con1, mail_id').eq('cpn_no', cpn_no).single()
      const { data: pushSub } = await supabase.from('push_subscriptions').select('subscription_json').eq('cpn_no', cpn_no).maybeSingle()

      const phoneNum = customer?.con1 ? String(customer.con1).replace(/\D/g, '') : null
      const emailAddress = customer?.mail_id

      // --- CHANNEL ROUTING EXECUTION ---

      // A. FIREBASE PUSH API (Moved to top so WhatsApp knows if it succeeded)
      if (target_channels.includes('FIREBASE')) {
        try {
          // Smart extraction: Look for the 'token' key inside the JSON object
          const fcmToken = pushSub?.subscription_json?.token 

          if (fcmToken) {
            // Build payload using Admin SDK structure (ported from your GAS webpush config)
            const fcmMessage = {
              token: fcmToken,
              notification: {
                title: raw_payload.title,
                body: raw_payload.body
              },
              webpush: {
                fcmOptions: {
                  link: raw_payload.push_url || "https://wowdrops.github.io/351_portal.html"
                }
              }
            }

            try {
              // Admin SDK automatically handles the OAuth2 token generation!
              await getMessaging().send(fcmMessage)
              finalCost += 0.00 // Pushes are free
              push_delivered = true // Mark as successfully delivered!
            } catch (fcmError: any) {
              const errorCode = fcmError.code || fcmError.errorInfo?.code
              
              // --- THE AUTO-CLEANUP LOGIC PORTED FROM GAS ---
              if (errorCode === 'messaging/registration-token-not-registered' || 
                  errorCode === 'messaging/invalid-registration-token' || 
                  errorCode === 'messaging/invalid-argument') {
                
                errors.push(`Push Error: Dead token detected. Auto-cleaned from database.`)
                
                // Instantly delete the dead token from Supabase so it doesn't fail again tomorrow
                await supabase.from('push_subscriptions').delete().eq('cpn_no', cpn_no)
              } else {
                errors.push(`Push Error: ${fcmError.message}`)
              }
            }

          } else {
            errors.push(`Push Skipped: Customer has no registered device token.`)
          }
        } catch (err: any) {
          errors.push(`Push System Failure: ${err.message}`)
        }
      }

      // B. WHATSAPP META API
      if (target_channels.includes('WHATSAPP') && phoneNum && raw_payload.wa_template) {
        
        // INTELLIGENT ROUTING CHECK
        if (routingPref === 'COST_SAVER' && push_delivered) {
            // Silently skip WhatsApp to save money. We don't log an error because this is a success state.
        } else {
            const waToken = Deno.env.get('META_WA_TOKEN')
            const waPhoneId = Deno.env.get('META_PHONE_ID')
            
            // FIXED LOGIC: Only attach components if variables exist, avoiding Meta strict crashes
            const templatePayload: any = {
              messaging_product: "whatsapp",
              to: `91${phoneNum.slice(-10)}`,
              type: "template",
              template: { name: raw_payload.wa_template, language: { code: "en" } }
            }

            if (raw_payload.wa_variables && raw_payload.wa_variables.length > 0) {
                templatePayload.template.components = [{
                    type: "body",
                    parameters: raw_payload.wa_variables.map((val: any) => ({ type: "text", text: String(val) }))
                }]
            }

            try {
              const waRes = await fetch(`https://graph.facebook.com/v17.0/${waPhoneId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(templatePayload)
              })
              
              const waData = await waRes.json()
              if (waData.error) errors.push(`WhatsApp Error: ${waData.error.message}`)
              else finalCost += 0.88 
            } catch (err: any) {
              errors.push(`WhatsApp Network Failure: ${err.message}`)
            }
        }
      } else if (target_channels.includes('WHATSAPP') && !phoneNum) {
        errors.push(`WhatsApp Skipped: No valid phone number.`)
      }

      // C. GMAIL VIA APPS SCRIPT
      if (target_channels.includes('GMAIL') && emailAddress && raw_payload.title) {
        const gasUrl = Deno.env.get('GAS_WEBHOOK_URL')
        if (gasUrl) {
          try {
            const emailRes = await fetch(gasUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({
                action: "send_email",
                email: emailAddress,
                subject: raw_payload.title,
                htmlBody: `<div style='font-family:sans-serif; padding:20px; max-width:600px; border:1px solid #e2e8f0; border-radius:8px;'>
                             <h2 style='color:#0f172a; margin-bottom:12px;'>${raw_payload.title}</h2>
                             <p style='color:#475569; font-size:15px; line-height:1.5;'>${raw_payload.body}</p>
                             
                             <div style='margin: 25px 0;'>
                               <a href='${raw_payload.push_url || "https://wowdrops.github.io/351_portal.html"}' style='background-color:#10b981; color:white; padding:10px 20px; text-decoration:none; border-radius:5px; font-weight:bold; display:inline-block;'>View Dashboard</a>
                             </div>

                             <hr style='border:none; border-top:1px solid #e2e8f0; margin:20px 0;'/>
                             <p style='color:#94a3b8; font-size:12px;'>This is an automated message from WOW DROPS.</p>
                           </div>`
              })
            })
            const emailData = await emailRes.json()
            if (!emailData.success) {
              errors.push(`Gmail Delivery Failed via GAS.`)
            }
          } catch (err: any) {
            errors.push(`Gmail Network Error: ${err.message}`)
          }
        }
      } else if (target_channels.includes('GMAIL') && !emailAddress) {
        errors.push(`Gmail Skipped: No valid email address found.`)
      }

      // 5. Aggregate Statuses & Unlock
      if (errors.length === target_channels.length && target_channels.length > 0) {
        finalStatus = 'FAILED'
      } else if (errors.length > 0) {
        finalStatus = 'PARTIAL_SUCCESS' // Custom middle state if 1 channel failed but another succeeded
      }

      await supabase.from('notification_logs').update({
        status: finalStatus,
        estimated_cost: finalCost,
        error_log: errors.length > 0 ? JSON.stringify(errors) : null,
        locked_at: null // Release the lock
      }).eq('id', id)

      processedCount++
    }

    return new Response(JSON.stringify({ success: true, processed: processedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Or 500
    })
  }
})