
    window.selectedBlocks = [];
    window.cachedQCBlocksData = {};
    window.currentStatusFilter = 'ALL';
    window.existingOrd2Data = {};

    // --- UNIVERSAL TIMER ENGINE ---
    window.activeQCTimerInterval = null;
    window.qcStartTime = 0;

    window.startQCTimer = function(actionLabel) {
      var timerBadge = document.getElementById('qc-live-timer');
      if (!timerBadge) return;
      
      timerBadge.outerHTML = '<span id="qc-live-timer" class="bg-indigo-100 text-indigo-800 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-indigo-200 shadow-inner flex items-center gap-1.5 min-w-max"><svg class="w-4 h-4 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="qc-timer-sec">0.00</span>s</span>';
      
      var badge = document.getElementById('qc-live-timer');
      badge.classList.remove('hidden');

      window.qcStartTime = performance.now();
      if(window.activeQCTimerInterval) clearInterval(window.activeQCTimerInterval);
      
      window.activeQCTimerInterval = setInterval(function() {
          var curr = ((performance.now() - window.qcStartTime) / 1000).toFixed(2);
          var secEl = document.getElementById('qc-timer-sec');
          if(secEl) secEl.innerText = curr;
      }, 50);
    };

    window.stopQCTimer = function(successLabel, isError) {
      if(window.activeQCTimerInterval) clearInterval(window.activeQCTimerInterval);
      var finalTime = ((performance.now() - window.qcStartTime) / 1000).toFixed(2);
      var badge = document.getElementById('qc-live-timer');
      if(badge) {
          if (isError) {
              badge.outerHTML = '<span id="qc-live-timer" class="bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg border border-red-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">Failed</span>';
          } else {
              badge.outerHTML = '<span id="qc-live-timer" class="bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">' + successLabel + ' in ' + finalTime + 's</span>';
          }
      }
    };
    // ------------------------------

    window.updateHeaderCounts = function () {
        var total = document.querySelectorAll('.qc-block-group').length;
        var finished = document.querySelectorAll('.qc-block-status.bg-emerald-500').length;
        var pending = total - finished;
        document.getElementById('qc-count-total').innerText = total;
        document.getElementById('qc-count-finished').innerText = finished;
        document.getElementById('qc-count-pending').innerText = pending;
    };

    window.getDoorExceptionState = function (d) {
        var actD = d.dvj + d.dnvj;
        var actE = d.evj + d.envj;
        
        var reqRep = d.replaceQty || 0;
        var actRep = (d.repVj || 0) + (d.repNvj || 0);

        var isShort = (d.ordD > actD) || (d.ordE > actE) || (reqRep > actRep);
        var hasVariance = (d.ordD !== actD) || (d.ordE !== actE) || (reqRep !== actRep);
        var isZeroActual = (actD === 0 && actE === 0 && actRep === 0);

        var rawComment = d.delComment || "";
        var cleanComment = rawComment.replace(/\[ROLLOVER:\s*(YES|NO)\]/g, "").trim();
        var hasDriverException = cleanComment !== "";

        return {
            isException: hasVariance || isZeroActual || hasDriverException,
            hasVariance: hasVariance,
            isShort: isShort,
            isZeroActual: isZeroActual,
            hasDriverException: hasDriverException,
            cleanComment: cleanComment
        };
    };

    window.updateExceptionBadge = function () {
        var count = 0;
        for (var blockId in window.cachedQCBlocksData) {
            window.cachedQCBlocksData[blockId].doors.forEach(d => {
                var state = window.getDoorExceptionState(d);
                if (state.isException) count++;
            });
        }
        var badge = document.getElementById('qc-exception-badge');
        if (badge) {
            badge.innerText = count;
            if (count > 0) badge.classList.remove('hidden');
            else badge.classList.add('hidden');
        }
    };

    window.toggleQCHeader = function () {
        var col = document.getElementById('qc-header-collapsible');
        var icon = document.getElementById('qc-header-icon');
        if (col.classList.contains('hidden')) { col.classList.remove('hidden'); icon.classList.add('rotate-180'); }
        else { col.classList.add('hidden'); icon.classList.remove('rotate-180'); }
    };

    window.parseImgUrl = function (url) {
        if (!url || String(url).trim() === "") return 'https://via.placeholder.com/100?text=No+Photo';
        var match = String(url).match(/[-\w]{25,}/);
        if (match && match[0]) return 'https://lh3.googleusercontent.com/d/' + match[0];
        return url;
    };

    function parsePDate(dateStr, byStr) {
        if (!dateStr) return "N/A";
        return (byStr ? byStr + " | " : "") + dateStr;
    }

    window.renderQCDashboard = function (blocksData) {
        var container = document.getElementById('qc-blocks-container');
        var html = '';

        for (var blockId in blocksData) {
            var block = blocksData[blockId];
            var v2bImgSrc = window.parseImgUrl(block.v2bPhoto);
            var b2vImgSrc = window.parseImgUrl(block.b2vPhoto);

            var isVerified = block.isBlockVerified;
            var statText = isVerified ? "VERIFIED" : "PENDING";
            var statClass = isVerified ? "bg-emerald-500 shadow text-white" : "bg-slate-600 text-white";
            var chkClass = isVerified ? "block" : "hidden";
            var chkChecked = isVerified ? "checked" : "";
            var freezeClass = isVerified ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-white text-slate-800 border-slate-400';
            var freezeAttr = isVerified ? 'disabled' : '';

            var preXf = block.varFull > 0 ? block.varFull : 0;
            var preSf = block.varFull < 0 ? Math.abs(block.varFull) : 0;
            var preXe = block.varEmp > 0 ? block.varEmp : 0;
            var preSe = block.varEmp < 0 ? Math.abs(block.varEmp) : 0;

            html += '<div class="bg-white rounded-2xl border border-slate-300 shadow-xl overflow-hidden qc-block-group mb-8" data-block-id="' + blockId + '">' +
                '<div class="bg-slate-800 p-4 text-white flex justify-between items-center shadow-inner">' +
                '<div class="flex items-center gap-3">' +
                '<input type="checkbox" value="' + blockId + '" class="w-6 h-6 rounded border-slate-500 bg-slate-700 cursor-pointer block-transfer-chk ' + chkClass + '" ' + chkChecked + ' onchange="window.toggleBlockSelection(this, \'' + blockId + '\')">' +
                '<h3 class="font-black text-lg md:text-xl tracking-widest uppercase">' + block.apartment + ' - Block ' + block.blockName + '</h3>' +
                '</div>' +
                '<span class="qc-block-status ' + statClass + ' px-4 py-1.5 rounded-lg font-black text-xs tracking-widest">' + statText + '</span>' +
                '</div>' +

                '<div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border-b-2 border-slate-200">' +

                '<div class="flex gap-4 items-center bg-white p-3 border border-slate-200 rounded-xl shadow-sm">' +
                '<div class="flex flex-col items-center gap-1 w-28">' +
                '<img src="' + v2bImgSrc + '" class="w-24 h-24 rounded-lg object-cover border-2 border-slate-200 cursor-pointer transition hover:scale-105" onclick="window.openLightbox(\'' + block.v2bPhoto + '\')" id="img-v2b-' + blockId + '">' +
                '<button onclick="window.overrideMasterPhoto(\'img-v2b-' + blockId + '\')" class="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition w-full">Override</button>' +
                '<p class="text-[8px] text-center font-bold text-slate-400 mt-1 uppercase leading-tight bg-slate-50 p-1 rounded border border-slate-100 w-full">' + parsePDate(block.unloadOn, block.unloadBy) + '</p>' +
                '</div>' +
                '<div class="flex-1"><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unloaded (Van to Block)</p>' +
                '<div class="flex items-center gap-2 mb-2"><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-20 p-2 text-2xl font-black rounded-lg border-2 text-center qc-inp-v2bf ' + freezeClass + '" value="' + block.v2bFulls + '" ' + freezeAttr + '><span class="text-xs font-black text-slate-500 tracking-widest">FULLS</span></div>' +
                '<div class="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-1 rounded w-max tracking-widest uppercase">🤖 AI: ' + block.v2bAI + '</div>' +
                '</div>' +
                '</div>' +

                '<div class="flex gap-4 items-center bg-white p-3 border border-slate-200 rounded-xl shadow-sm">' +
                '<div class="flex flex-col items-center gap-1 w-28">' +
                '<img src="' + b2vImgSrc + '" class="w-24 h-24 rounded-lg object-cover border-2 border-slate-200 cursor-pointer transition hover:scale-105" onclick="window.openLightbox(\'' + block.b2vPhoto + '\')" id="img-b2v-' + blockId + '">' +
                '<button onclick="window.overrideMasterPhoto(\'img-b2v-' + blockId + '\')" class="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition w-full">Override</button>' +
                '<p class="text-[8px] text-center font-bold text-slate-400 mt-1 uppercase leading-tight bg-slate-50 p-1 rounded border border-slate-100 w-full">' + parsePDate(block.loadOn, block.loadBy) + '</p>' +
                '</div>' +
                '<div class="flex-1"><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Loaded (Block to Van)</p>' +
                '<div class="flex items-center gap-4 mb-2">' +
                '<div class="flex items-center gap-1"><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-16 p-2 text-xl font-black rounded-lg border-2 text-emerald-700 text-center qc-inp-b2vf ' + freezeClass + '" value="' + block.b2vFulls + '" ' + freezeAttr + '><span class="text-[10px] font-black text-emerald-600 tracking-widest">F</span></div>' +
                '<div class="flex items-center gap-1"><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-16 p-2 text-xl font-black rounded-lg border-2 text-amber-700 text-center qc-inp-b2ve ' + freezeClass + '" value="' + block.b2vEmpties + '" ' + freezeAttr + '><span class="text-[10px] font-black text-amber-600 tracking-widest">E</span></div>' +
                '</div>' +
                '<div class="flex gap-2"><div class="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-1 rounded w-max tracking-widest uppercase">🤖 AI: ' + block.b2vF_AI + ' F</div><div class="bg-amber-50 border border-amber-100 text-amber-700 text-[9px] font-black px-2 py-1 rounded w-max tracking-widest uppercase">🤖 AI: ' + block.b2vE_AI + ' E</div></div>' +
                '</div>' +
                '</div>' +
                '</div>' +

                '<div class="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-300">' +
                '<div class="col-span-3">Customer Profile</div><div class="col-span-1 text-center">Ordered</div><div class="col-span-4 text-center">Actual Delivery (2x2)</div><div class="col-span-2 text-center">QC Photo</div><div class="col-span-2 text-center">Action</div>' +
                '</div><div class="bg-white qc-doors-list">';

            for (var i = 0; i < block.doors.length; i++) {
                var door = block.doors[i];
                var isDoorChecked = door.isVerified ? 'checked' : '';
                var dFzClass = door.isVerified ? 'bg-slate-200 text-slate-400 border-slate-200' : 'bg-white text-slate-800 border-indigo-200';
                var dFzAttr = door.isVerified ? 'disabled' : '';
                var doorPhotoRaw = door.doorPhoto || "";
                var uniqImgId = "img-" + blockId + "-" + door.sheetRow;

                var cmtUI = '';
                if (door.delComment) {
                    var hasDeferred = door.delComment.includes("[DEFERRED");
                    var hasCancelled = door.delComment.includes("[CANCELLED");
                    var badgeColor = hasDeferred ? 'amber' : (hasCancelled ? 'rose' : 'slate');
                    cmtUI = '<div class="mt-1.5 inline-block text-[9px] font-black bg-' + badgeColor + '-50 text-' + badgeColor + '-700 px-1.5 py-0.5 rounded border border-' + badgeColor + '-200 uppercase tracking-widest leading-tight shadow-sm">💬 ' + door.delComment + '</div>';
                }

                html += '<div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white border-b border-slate-100 p-4 md:px-6 md:py-3 qc-door-row hover:bg-slate-50 transition" data-row-idx="' + door.sheetRow + '" data-photo-url="' + doorPhotoRaw + '">' +
                    '<div class="col-span-1 md:col-span-3 flex justify-between md:block items-start"><span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Door</span><div><p class="font-black text-lg text-slate-800">Door ' + door.doorNo + '</p><p class="text-xs font-bold text-blue-500 tracking-widest uppercase">' + door.cpn + '</p>' + cmtUI + '</div></div>' +
                    '<div class="col-span-1 md:col-span-1 flex justify-between md:justify-center items-center gap-2"><span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Ordered</span><div class="flex flex-row gap-2"><div class="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-center"><span class="font-black text-slate-700">' + door.ordD + '</span> <span class="text-[9px] font-bold text-slate-400">F</span></div><div class="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-center"><span class="font-black text-slate-700">' + door.ordE + '</span> <span class="text-[9px] font-bold text-slate-400">E</span></div></div></div>' +
                    '<div class="col-span-1 md:col-span-4 flex flex-col justify-center items-center gap-2"><span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest w-full text-left">Actuals</span>' +
                    '<div class="flex gap-2 w-full justify-center">' +
                    '<div class="relative flex items-center gap-1"><span class="text-[9px] font-black text-slate-400 uppercase w-6">VJ</span><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1.5 border-2 rounded font-black text-center outline-none qc-inp-actd-vj ' + dFzClass + '" value="' + door.dvj + '" ' + dFzAttr + ' title="VJ Full"><span class="text-[9px] font-bold text-slate-400">F</span></div>' +
                    '<div class="relative flex items-center gap-1 ml-2"><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1.5 border-2 rounded font-black text-center outline-none qc-inp-acte-vj ' + dFzClass + '" value="' + door.evj + '" ' + dFzAttr + ' title="VJ Empty"><span class="text-[9px] font-bold text-slate-400">E</span></div>' +
                    '</div>' +
                    '<div class="flex gap-2 w-full justify-center">' +
                    '<div class="relative flex items-center gap-1"><span class="text-[9px] font-black text-slate-400 uppercase w-6">NVJ</span><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1.5 border-2 rounded font-black text-center outline-none qc-inp-actd-nvj ' + dFzClass + '" value="' + door.dnvj + '" ' + dFzAttr + ' title="NVJ Full"><span class="text-[9px] font-bold text-slate-400">F</span></div>' +
                    '<div class="relative flex items-center gap-1 ml-2"><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1.5 border-2 rounded font-black text-center outline-none qc-inp-acte-nvj ' + dFzClass + '" value="' + door.envj + '" ' + dFzAttr + ' title="NVJ Empty"><span class="text-[9px] font-bold text-slate-400">E</span></div>' +
                    '</div>' +
                    '<div class="flex gap-4 mt-1"><span class="text-[8px] font-black text-indigo-400 bg-indigo-50 px-1.5 rounded uppercase tracking-widest border border-indigo-100">🤖 AI F: ' + door.aiD + '</span><span class="text-[8px] font-black text-amber-400 bg-amber-50 px-1.5 rounded uppercase tracking-widest border border-amber-100">🤖 AI E: ' + door.aiE + '</span></div>';

                    var repUI = '';
                    if (door.replaceQty > 0) {
                        repUI = '<div class="mt-2 bg-amber-50 p-2 rounded-lg border border-amber-200 shadow-inner w-full max-w-[240px]">' +
                                '<div class="text-[9px] font-black text-amber-800 uppercase text-center mb-1">Rep Ord: ' + door.replaceQty + ' (' + door.replaceReason + ')</div>' +
                                '<div class="flex gap-2 w-full justify-center">' +
                                '<div class="relative flex items-center gap-1"><span class="text-[9px] font-black text-amber-600 uppercase w-6">VJ</span><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1 border border-amber-300 rounded font-black text-center outline-none qc-inp-actrep-vj ' + dFzClass + '" value="' + door.repVj + '" ' + dFzAttr + '></div>' +
                                '<div class="relative flex items-center gap-1 ml-2"><span class="text-[9px] font-black text-amber-600 uppercase w-6">NVJ</span><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1 border border-amber-300 rounded font-black text-center outline-none qc-inp-actrep-nvj ' + dFzClass + '" value="' + door.repNvj + '" ' + dFzAttr + '></div>' +
                                '</div></div>';
                    }
                    
            html += repUI + '</div>';

            html += '<div class="col-span-1 md:col-span-2 flex justify-between md:justify-center items-center"><span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Photo</span><div class="flex flex-col items-center gap-1 w-24"><img id="' + uniqImgId + '" src="' + window.parseImgUrl(doorPhotoRaw) + '" class="w-20 h-20 rounded-lg object-cover border-2 border-slate-200 cursor-pointer hover:border-blue-400 transition hover:scale-110 shadow-sm" onclick="window.openLightbox(\'' + doorPhotoRaw + '\')"><button onclick="window.overrideRowPhoto(\'' + uniqImgId + '\')" class="text-[8px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition w-full">Override</button><p class="text-[7px] text-center font-bold text-slate-400 uppercase leading-tight bg-slate-50 p-1 rounded border border-slate-100 w-full mt-1">' + parsePDate(door.enterOn, door.enterBy) + '</p></div></div>' +
                    '<div class="col-span-1 md:col-span-2 flex justify-between md:justify-center items-center"><span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span><label class="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 transition"><input type="checkbox" onchange="window.toggleDoorQC(this, \'' + blockId + '\')" class="w-5 h-5 rounded text-emerald-600 qc-door-chk" ' + isDoorChecked + '><span class="text-xs font-black text-slate-600 uppercase tracking-widest">Verify</span></label></div>' +
                    '</div>';
            }

            html += '</div>' +
                '<div class="bg-slate-100 p-4 md:p-6 border-t-2 border-slate-200">' +
                '<div class="qc-math-summary-card bg-indigo-50 border-2 border-indigo-100 rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-6 transition-colors">' +
                '<div class="flex-1"><p class="text-[10px] font-black uppercase tracking-widest mb-1 qc-math-label text-indigo-400">Load To Van: Full Cans</p><p class="text-base font-black qc-math-text text-indigo-900">Calculated: <span class="qc-sys-fulls text-xl">0</span> <span class="text-sm font-bold mx-2">|</span> Driver Claim: <span class="qc-disp-b2vf text-xl">' + block.b2vFulls + '</span></p></div>' +
                '<div class="flex-1 border-t md:border-t-0 md:border-l border-indigo-200 qc-math-divider pt-3 md:pt-0 md:pl-6"><p class="text-[10px] font-black uppercase tracking-widest mb-1 qc-math-label text-indigo-400">Load To Van: Empty Cans</p><p class="text-base font-black qc-math-text text-indigo-900">Calculated: <span class="qc-sys-empties text-xl">0</span> <span class="text-sm font-bold mx-2">|</span> Driver Claim: <span class="qc-disp-b2ve text-xl">' + block.b2vEmpties + '</span></p></div>' +
                '</div>' +
                '<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">' +
                '<div><label class="text-[10px] font-black uppercase text-slate-500 tracking-widest">Excess Full</label><input type="number" class="w-full p-2.5 rounded-lg border-2 border-slate-200 font-bold text-slate-700 outline-none qc-var-xf" value="' + preXf + '"></div>' +
                '<div><label class="text-[10px] font-black uppercase text-slate-500 tracking-widest">Short Full</label><input type="number" class="w-full p-2.5 rounded-lg border-2 border-slate-200 font-bold text-slate-700 outline-none qc-var-sf" value="' + preSf + '"></div>' +
                '<div><label class="text-[10px] font-black uppercase text-slate-500 tracking-widest">Excess Empty</label><input type="number" class="w-full p-2.5 rounded-lg border-2 border-slate-200 font-bold text-slate-700 outline-none qc-var-xe" value="' + preXe + '"></div>' +
                '<div><label class="text-[10px] font-black uppercase text-slate-500 tracking-widest">Short Empty</label><input type="number" class="w-full p-2.5 rounded-lg border-2 border-slate-200 font-bold text-slate-700 outline-none qc-var-se" value="' + preSe + '"></div>' +
                '<div><label class="text-[10px] font-black uppercase text-slate-500 tracking-widest">Reason</label><input type="text" placeholder="Note..." class="w-full p-2.5 rounded-lg border-2 border-slate-200 font-bold text-slate-700 outline-none qc-var-reason" value="' + block.reason + '"></div>' +
                '</div>' +
                '<div class="flex flex-col md:flex-row justify-between items-center gap-3">' +
                '<button disabled class="w-full md:w-auto text-xs font-black text-slate-400 bg-slate-200 cursor-not-allowed px-6 py-3 rounded-xl transition">+ Walk-Up Delivery</button>' +
                '<button onclick="window.verifyBlockQC(\'' + blockId + '\')" class="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3 rounded-xl shadow active:scale-95 transition tracking-widest uppercase text-sm btn-verify-block">Verify Math</button>' +
                '</div></div></div>';
        }
        container.innerHTML = html;
    };

    window.closeExceptionReview = function () {
        document.getElementById('admin-exception-modal').classList.add('hidden');
    };

    window.activeUploadContext = null;

    window.overrideMasterPhoto = function (imgId) {
        var parts = imgId.split('-');
        if (parts.length < 3) return;
        var type = parts[1];
        var blockId = parts.slice(2).join('-');
        var bData = window.cachedQCBlocksData[blockId];
        if (!bData) return;
        window.activeUploadContext = { type: type, imgId: imgId, apt: bData.apartment, blk: bData.blockName, blockId: blockId };
        document.getElementById('admin-qc-upload-input').click();
    };

    window.overrideRowPhoto = function (imgId) {
        var el = document.getElementById(imgId);
        var rowEl = el.closest('.qc-door-row');
        var blockEl = el.closest('.qc-block-group');
        var rIdx = parseInt(rowEl.getAttribute('data-row-idx'));
        var blockId = blockEl.getAttribute('data-block-id');
        var bData = window.cachedQCBlocksData[blockId];

        if (!bData) return;
        var doorUnique = null;
        if (rIdx > 0) {
            var cachedDoor = bData.doors.find(d => d.sheetRow === rIdx);
            if (cachedDoor) doorUnique = cachedDoor.uniqueNo;
        }
        if (!doorUnique) return alert("Cannot override phantom door until synced.");
        window.activeUploadContext = { type: 'door', imgId: imgId, apt: bData.apartment, blk: bData.blockName, doorUniqueNo: doorUnique, blockId: blockId };
        document.getElementById('admin-qc-upload-input').click();
    };

    window.showAdminUploadLoader = function (msg) {
        var loader = document.getElementById('admin-qc-upload-overlay');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'admin-qc-upload-overlay';
            loader.className = 'fixed inset-0 z-[9999] bg-slate-900/90 flex flex-col items-center justify-center backdrop-blur-sm transition-opacity';
            loader.innerHTML = '<svg class="animate-spin h-16 w-16 text-emerald-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p id="admin-qc-upload-text" class="text-white font-black tracking-widest uppercase text-sm animate-pulse">' + msg + '</p>';
            document.body.appendChild(loader);
        } else {
            document.getElementById('admin-qc-upload-text').innerText = msg;
            loader.classList.remove('hidden');
            loader.classList.add('flex');
        }
    };

    window.hideAdminUploadLoader = function () {
        var loader = document.getElementById('admin-qc-upload-overlay');
        if (loader) { loader.classList.add('hidden'); loader.classList.remove('flex'); }
    };

    document.addEventListener("DOMContentLoaded", function () {
        var exceptionModal = document.getElementById('admin-exception-modal');
        if (exceptionModal) document.body.appendChild(exceptionModal);

        var fileInput = document.getElementById('admin-qc-upload-input');
        if (fileInput) {
            fileInput.addEventListener('change', function (e) {
                if (!e.target.files || e.target.files.length === 0) return;
                var file = e.target.files[0];
                if (!window.activeUploadContext) return;

                window.showAdminUploadLoader("Compressing & Watermarking...");
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        window.compressAndWatermarkAdminImage(file).then(function (b64) {
                            document.getElementById('admin-qc-upload-text').innerText = "Saving to Server & Drive...";
                            var payload = window.activeUploadContext;
                            payload.base64 = b64;
                            google.script.run.withSuccessHandler(function (res) {
                                window.hideAdminUploadLoader();
                                e.target.value = '';
                                if (res.success) {
                                    var imgEl = document.getElementById(payload.imgId);
                                    imgEl.src = window.parseImgUrl(res.url);
                                    imgEl.setAttribute('onclick', 'window.openLightbox("' + res.url + '")');
                                    if (payload.type === 'door') imgEl.closest('.qc-door-row').setAttribute('data-photo-url', res.url);
                                    else if (payload.type === 'v2b') window.cachedQCBlocksData[payload.blockId].v2bPhoto = res.url;
                                    else if (payload.type === 'b2v') window.cachedQCBlocksData[payload.blockId].b2vPhoto = res.url;
                                } else {
                                    alert("Database Upload Failed: " + res.message);
                                }
                            }).adminUpdateQCPhoto(payload);
                        }).catch(function (err) {
                            window.hideAdminUploadLoader();
                            e.target.value = '';
                            alert("Image processing error: " + err);
                        });
                    });
                });
            });
        }
    });

    window.compressAndWatermarkAdminImage = function (file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = function (e) {
                var img = new Image();
                img.src = e.target.result;
                img.onload = function () {
                    var canvas = document.createElement('canvas');
                    canvas.width = 800;
                    canvas.height = img.height * (800 / img.width);
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    var now = new Date();
                    var timeString = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + " | " + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    var watermark1 = "ADMIN OVERRIDE UPLOAD";
                    var watermark2 = "Date: " + timeString;
                    ctx.fillStyle = "rgba(185, 28, 28, 0.85)";
                    ctx.fillRect(0, canvas.height - 75, canvas.width, 75);
                    ctx.fillStyle = "#ffffff";
                    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
                    ctx.shadowBlur = 4; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
                    ctx.font = "bold 22px sans-serif";
                    ctx.fillText(watermark1, 20, canvas.height - 45);
                    ctx.font = "bold 18px sans-serif";
                    ctx.fillText(watermark2, 20, canvas.height - 18);
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                };
                img.onerror = function () { reject("Failed to load image into canvas."); };
            };
            reader.onerror = function (e) { reject("Failed to read file."); };
        });
    };

    window.sortBlocks = function () {
        var container = document.getElementById('qc-blocks-container');
        var blocks = Array.from(container.querySelectorAll('.qc-block-group'));
        blocks.sort(function (a, b) {
            var statusA = a.querySelector('.qc-block-status').innerText === "VERIFIED" ? 1 : 0;
            var statusB = b.querySelector('.qc-block-status').innerText === "VERIFIED" ? 1 : 0;
            return statusA - statusB;
        });
        blocks.forEach(function (block) { container.appendChild(block); });
    };

    window.toggleAllVerifiedBlocks = function (mainCheckbox) {
        var isChecked = mainCheckbox.checked;
        var visibleVerifiedCheckboxes = document.querySelectorAll('.block-transfer-chk:not(.hidden)');
        visibleVerifiedCheckboxes.forEach(chk => {
            var blockGroup = chk.closest('.qc-block-group');
            if (blockGroup.style.display !== 'none') {
                chk.checked = isChecked;
                var blockId = chk.value;
                if (isChecked) { if (!window.selectedBlocks.includes(blockId)) window.selectedBlocks.push(blockId); } 
                else { window.selectedBlocks = window.selectedBlocks.filter(id => id !== blockId); }
            }
        });
        window.checkTransferReady();
    };

    window.checkTransferReady = function () {
        var transferBtn = document.getElementById('btn-transfer-sales');
        var count = window.selectedBlocks.length;
        if (count > 0) {
            transferBtn.disabled = false;
            transferBtn.classList.replace('bg-slate-400', 'bg-emerald-600');
            transferBtn.classList.remove('cursor-not-allowed');
            transferBtn.innerHTML = '<svg class="w-4 h-4 md:w-5 md:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Process <span class="hidden sm:inline">Selected</span> (' + count + ')';
        } else {
            transferBtn.disabled = true;
            transferBtn.classList.replace('bg-emerald-600', 'bg-slate-400');
            transferBtn.classList.add('cursor-not-allowed');
            transferBtn.innerHTML = '<svg class="w-4 h-4 md:w-5 md:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Process <span class="hidden sm:inline">Selected</span> (0)';
        }
    };

    window.toggleBlockSelection = function (checkbox, blockId) {
        if (checkbox.checked) { if (!window.selectedBlocks.includes(blockId)) window.selectedBlocks.push(blockId); } 
        else { window.selectedBlocks = window.selectedBlocks.filter(id => id !== blockId); }
        window.checkTransferReady();
    };

    window.updateBlockMath = function (blockId, preventUnverify) {
        var blockGroup = document.querySelector('.qc-block-group[data-block-id="' + blockId + '"]');
        var bData = window.cachedQCBlocksData[blockId]; 
        var driverV2bF = parseInt(blockGroup.querySelector('.qc-inp-v2bf').value) || 0;
        var driverB2vF = parseInt(blockGroup.querySelector('.qc-inp-b2vf').value) || 0;
        var driverB2vE = parseInt(blockGroup.querySelector('.qc-inp-b2ve').value) || 0;

        blockGroup.querySelector('.qc-disp-b2vf').innerText = driverB2vF;
        blockGroup.querySelector('.qc-disp-b2ve').innerText = driverB2vE;

        var sumActD = 0, sumActE = 0, sumRep = 0;
        blockGroup.querySelectorAll('.qc-door-row').forEach(row => {
            var rIdx = parseInt(row.getAttribute('data-row-idx'));
            var dvj = parseInt(row.querySelector('.qc-inp-actd-vj').value) || 0;
            var dnvj = parseInt(row.querySelector('.qc-inp-actd-nvj').value) || 0;
            var evj = parseInt(row.querySelector('.qc-inp-acte-vj').value) || 0;
            var envj = parseInt(row.querySelector('.qc-inp-acte-nvj').value) || 0;
            var repVjInp = row.querySelector('.qc-inp-actrep-vj');
            var repNvjInp = row.querySelector('.qc-inp-actrep-nvj');
            var rvj = repVjInp ? parseInt(repVjInp.value) || 0 : 0;
            var rnvj = repNvjInp ? parseInt(repNvjInp.value) || 0 : 0;

            sumActD += (dvj + dnvj); sumActE += (evj + envj); sumRep += (rvj + rnvj);
            if (bData && rIdx > 0) {
                var cachedDoor = bData.doors.find(d => d.sheetRow === rIdx);
                if (cachedDoor) {
                    cachedDoor.dvj = dvj; cachedDoor.dnvj = dnvj;
                    cachedDoor.evj = evj; cachedDoor.envj = envj;
                    cachedDoor.repVj = rvj; cachedDoor.repNvj = rnvj; 
                }
            }
        });

        var sysFulls = driverV2bF - sumActD - sumRep;
        var sysEmpties = sumActE + sumRep;

        blockGroup.querySelector('.qc-sys-fulls').innerText = sysFulls;
        blockGroup.querySelector('.qc-sys-empties').innerText = sysEmpties;

        var card = blockGroup.querySelector('.qc-math-summary-card');
        var labels = card.querySelectorAll('.qc-math-label');
        var texts = card.querySelectorAll('.qc-math-text');
        var divider = card.querySelector('.qc-math-divider');

        if (sysFulls !== driverB2vF || sysEmpties !== driverB2vE) {
            card.className = "qc-math-summary-card bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-6 transition-colors shadow-inner";
            labels.forEach(l => l.className = "text-[10px] font-black uppercase tracking-widest mb-1 qc-math-label text-red-500");
            texts.forEach(t => t.className = "text-base font-black qc-math-text text-red-900");
            divider.className = "flex-1 border-t md:border-t-0 md:border-l border-red-200 qc-math-divider pt-3 md:pt-0 md:pl-6";
        } else {
            card.className = "qc-math-summary-card bg-indigo-50 border-2 border-indigo-100 rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-6 transition-colors";
            labels.forEach(l => l.className = "text-[10px] font-black uppercase tracking-widest mb-1 qc-math-label text-indigo-400");
            texts.forEach(t => t.className = "text-base font-black qc-math-text text-indigo-900");
            divider.className = "flex-1 border-t md:border-t-0 md:border-l border-indigo-200 qc-math-divider pt-3 md:pt-0 md:pl-6";
        }

        if (typeof window.updateExceptionBadge === "function") window.updateExceptionBadge();
        if (!preventUnverify) window.unverifyBlock(blockId);
    };

    window.toggleDoorQC = function (checkbox, blockId) {
        var row = checkbox.closest('.qc-door-row');
        var rIdx = parseInt(row.getAttribute('data-row-idx'));
        var inputs = row.querySelectorAll('input[type="number"]');

        var d_vj = parseInt(row.querySelector('.qc-inp-actd-vj').value) || 0;
        var e_vj = parseInt(row.querySelector('.qc-inp-acte-vj').value) || 0;
        var d_nvj = parseInt(row.querySelector('.qc-inp-actd-nvj').value) || 0;
        var e_nvj = parseInt(row.querySelector('.qc-inp-acte-nvj').value) || 0;
        
        var elRepVj = row.querySelector('.qc-inp-actrep-vj');
        var elRepNvj = row.querySelector('.qc-inp-actrep-nvj');
        var r_repVj = elRepVj ? parseInt(elRepVj.value) || 0 : 0;
        var r_repNvj = elRepNvj ? parseInt(elRepNvj.value) || 0 : 0;

        var bData = window.cachedQCBlocksData[blockId];
        var doorUnique = null;
        if (bData) {
            var cachedDoor = bData.doors.find(d => d.sheetRow === rIdx);
            if (cachedDoor) doorUnique = cachedDoor.uniqueNo;
        }

        var payload = {};
        if (checkbox.checked) {
            inputs.forEach(inp => { inp.disabled = true; inp.classList.add('bg-slate-200', 'text-slate-400', 'border-slate-200'); inp.classList.remove('bg-white', 'text-slate-800', 'border-indigo-200'); });
            if (doorUnique) payload.verifyDoors = [{ id: doorUnique, dvj: d_vj, evj: e_vj, dnvj: d_nvj, envj: e_nvj, repVj: r_repVj,repNvj: r_repNvj }];
        } else {
            inputs.forEach(inp => { inp.disabled = false; inp.classList.remove('bg-slate-200', 'text-slate-400', 'border-slate-200'); inp.classList.add('bg-white', 'text-slate-800', 'border-indigo-200'); });
            if (doorUnique) payload.unverifyDoors = [{ id: doorUnique, dvj: d_vj, evj: e_vj, dnvj: d_nvj, envj: e_nvj, repVj: r_repVj,repNvj: r_repNvj }];
            window.unverifyBlock(blockId, true);
        }

        if (!checkbox.checked && bData) payload.unverifyBlocks = [{ apt: bData.apartment, blk: bData.blockName }];
        if (Object.keys(payload).length > 0) google.script.run.withSuccessHandler(function () { }).syncQCState(payload);
    };

    window.unverifyBlock = function (blockId, skipSync) {
        var blockGroup = document.querySelector('.qc-block-group[data-block-id="' + blockId + '"]');
        var blockStatus = blockGroup.querySelector('.qc-block-status');
        if (blockStatus.innerText === "PENDING") return;

        blockStatus.innerText = "PENDING";
        blockStatus.className = "qc-block-status bg-slate-600 px-3 py-1 rounded font-bold text-xs";
        var transferChk = blockGroup.querySelector('.block-transfer-chk');
        transferChk.checked = false;
        transferChk.classList.replace('block', 'hidden');

        blockGroup.querySelectorAll('.qc-inp-v2bf, .qc-inp-b2vf, .qc-inp-b2ve').forEach(inp => {
            inp.disabled = false;
            inp.classList.remove('bg-slate-200', 'text-slate-500', 'border-slate-300');
        });

        window.selectedBlocks = window.selectedBlocks.filter(id => id !== blockId);
        window.checkTransferReady();
        document.getElementById('qc-select-all-chk').checked = false;

        if (!skipSync) {
            var bData = window.cachedQCBlocksData[blockId];
            if (bData) {
                var payload = { unverifyBlocks: [{ apt: bData.apartment, blk: bData.blockName }] };
                google.script.run.withSuccessHandler(function () { }).syncQCState(payload);
            }
        }
        window.updateHeaderCounts();
        window.sortBlocks();
    };

    window.verifyBlockQC = function (blockId) {
        var blockGroup = document.querySelector('.qc-block-group[data-block-id="' + blockId + '"]');
        var uncheckedDoors = blockGroup.querySelectorAll('.qc-door-chk:not(:checked)');
        if (uncheckedDoors.length > 0) return alert("You must verify all doors in this block first.");

        var sysFulls = parseInt(blockGroup.querySelector('.qc-sys-fulls').innerText) || 0;
        var sysEmpties = parseInt(blockGroup.querySelector('.qc-sys-empties').innerText) || 0;
        var driverV2bF = parseInt(blockGroup.querySelector('.qc-inp-v2bf').value) || 0;
        var driverB2vF = parseInt(blockGroup.querySelector('.qc-inp-b2vf').value) || 0;
        var driverB2vE = parseInt(blockGroup.querySelector('.qc-inp-b2ve').value) || 0;

        var xF = parseInt(blockGroup.querySelector('.qc-var-xf').value) || 0;
        var sF = parseInt(blockGroup.querySelector('.qc-var-sf').value) || 0;
        var xE = parseInt(blockGroup.querySelector('.qc-var-xe').value) || 0;
        var sE = parseInt(blockGroup.querySelector('.qc-var-se').value) || 0;
        var reason = blockGroup.querySelector('.qc-var-reason').value || "Verified";

        var finalCalcFulls = sysFulls + xF - sF;
        var finalCalcEmpties = sysEmpties + xE - sE;

        if (finalCalcFulls !== driverB2vF) return alert("Full Cans Math Error!\n\nPlease use Excess/Short Variance boxes to balance this discrepancy.");
        if (finalCalcEmpties !== driverB2vE) return alert("Empty Cans Math Error!\n\nPlease use Excess/Short Variance boxes to balance this discrepancy.");

        var blockStatus = blockGroup.querySelector('.qc-block-status');
        blockStatus.innerText = "VERIFIED";
        blockStatus.className = "qc-block-status bg-emerald-500 px-4 py-1.5 rounded-lg font-black text-xs tracking-widest shadow text-white";

        var transferChk = blockGroup.querySelector('.block-transfer-chk');
        transferChk.classList.replace('hidden', 'block');
        transferChk.checked = true;

        blockGroup.querySelectorAll('.qc-inp-v2bf, .qc-inp-b2vf, .qc-inp-b2ve').forEach(inp => {
            inp.disabled = true;
            inp.classList.add('bg-slate-200', 'text-slate-500', 'border-slate-300');
        });

        if (!window.selectedBlocks.includes(blockId)) window.selectedBlocks.push(blockId);
        window.checkTransferReady();

        var bData = window.cachedQCBlocksData[blockId];
        if (bData) {
            var payload = {
                verifyBlocks: [{
                    apt: bData.apartment, blk: bData.blockName,
                    fullVar: xF - sF, empVar: xE - sE, reason: reason,
                    v2bF: driverV2bF, b2vF: driverB2vF, b2vE: driverB2vE
                }]
            };
            google.script.run.withSuccessHandler(function () { }).syncQCState(payload);
        }
        window.updateHeaderCounts();
        setTimeout(window.sortBlocks, 300);
    };

    window.autoVerifyPerfectBlocks = function () {
        var blocks = document.querySelectorAll('.qc-block-group');
        var payload = { verifyBlocks: [], verifyDoors: [] };
        var verifiedCount = 0;

        blocks.forEach(block => {
            var status = block.querySelector('.qc-block-status').innerText;
            if (status === "VERIFIED") return;
            var blockId = block.getAttribute('data-block-id');
            window.updateBlockMath(blockId);

            var sysFulls = parseInt(block.querySelector('.qc-sys-fulls').innerText) || 0;
            var sysEmpties = parseInt(block.querySelector('.qc-sys-empties').innerText) || 0;
            var driverV2bF = parseInt(block.querySelector('.qc-inp-v2bf').value) || 0;
            var driverB2vF = parseInt(block.querySelector('.qc-inp-b2vf').value) || 0;
            var driverB2vE = parseInt(block.querySelector('.qc-inp-b2ve').value) || 0;

            if (sysFulls === driverB2vF && sysEmpties === driverB2vE) {
                var bData = window.cachedQCBlocksData[blockId];
                if (!bData) return;

                var doors = block.querySelectorAll('.qc-door-chk:not(:checked)');
                doors.forEach(chk => {
                    chk.checked = true;
                    var row = chk.closest('.qc-door-row');
                    row.querySelectorAll('input[type="number"]').forEach(inp => { inp.disabled = true; inp.classList.add('bg-slate-200', 'text-slate-400', 'border-slate-200'); });
                    var rIdx = parseInt(row.getAttribute('data-row-idx'));

                    var d_vj = parseInt(row.querySelector('.qc-inp-actd-vj').value) || 0;
                    var e_vj = parseInt(row.querySelector('.qc-inp-acte-vj').value) || 0;
                    var d_nvj = parseInt(row.querySelector('.qc-inp-actd-nvj').value) || 0;
                    var e_nvj = parseInt(row.querySelector('.qc-inp-acte-nvj').value) || 0;
                    var elRepVj = row.querySelector('.qc-inp-actrep-vj');
                    var elRepNvj = row.querySelector('.qc-inp-actrep-nvj');
                    var r_vj = elRepVj ? parseInt(elRepVj.value) || 0 : 0;
                    var r_nvj = elRepNvj ? parseInt(elRepNvj.value) || 0 : 0;

                    var cachedDoor = bData.doors.find(d => d.sheetRow === rIdx);
                    if (cachedDoor && cachedDoor.uniqueNo) {
                        payload.verifyDoors.push({ 
                            id: cachedDoor.uniqueNo, dvj: d_vj, evj: e_vj, dnvj: d_nvj, envj: e_nvj, repVj: r_vj, repNvj: r_nvj
                        });
                    }
                });

                block.querySelector('.qc-var-xf').value = 0; block.querySelector('.qc-var-sf').value = 0;
                block.querySelector('.qc-var-xe').value = 0; block.querySelector('.qc-var-se').value = 0;
                block.querySelector('.qc-var-reason').value = "Auto-Verified Perfect Match";

                block.querySelector('.qc-block-status').innerText = "VERIFIED";
                block.querySelector('.qc-block-status').className = "qc-block-status bg-emerald-500 px-4 py-1.5 rounded-lg font-black text-xs tracking-widest shadow text-white";
                block.querySelectorAll('.qc-inp-v2bf, .qc-inp-b2vf, .qc-inp-b2ve').forEach(inp => { inp.disabled = true; inp.classList.add('bg-slate-200', 'text-slate-500', 'border-slate-300'); });
                var transferChk = block.querySelector('.block-transfer-chk');
                transferChk.classList.replace('hidden', 'block');
                transferChk.checked = true;

                if (!window.selectedBlocks.includes(blockId)) window.selectedBlocks.push(blockId);

                payload.verifyBlocks.push({
                    apt: bData.apartment, blk: bData.blockName, fullVar: 0, empVar: 0, reason: "Auto-Verified Perfect Match",
                    v2bF: driverV2bF, b2vF: driverB2vF, b2vE: driverB2vE
                });
                verifiedCount++;
            }
        });

        if (verifiedCount > 0) {
            window.startQCTimer('Auto-Verifying');
            google.script.run.withSuccessHandler(function (res) { 
                if (res.success) {
                    window.stopQCTimer('Verified', false);
                    alert("⚡ Successfully Auto-Verified " + verifiedCount + " perfect blocks!");
                } else {
                    window.stopQCTimer('Failed', true);
                    alert("Backend sync error: " + res.message);
                }
            }).withFailureHandler(function(err) {
                window.stopQCTimer('Failed', true);
                alert("Server connection failed: " + err);
            }).syncQCState(payload);
            
            window.updateHeaderCounts(); window.checkTransferReady(); window.sortBlocks();
        } else {
            alert("No perfect matches found. All remaining blocks require manual verification.");
        }
    };

    window.loadDeliveryQCData = function () {
        window.startQCTimer('Loading');
        
        document.getElementById('qc-blocks-container').innerHTML = '<div class="text-center p-8 font-bold text-slate-500 animate-pulse">Loading Pending Deliveries...</div>';
        window.selectedBlocks = [];
        document.getElementById('qc-select-all-chk').checked = false;

        google.script.run
            .withFailureHandler(function (err) {
                window.stopQCTimer('Failed', true);
                alert("Server connection failed: " + err);
                document.getElementById('qc-blocks-container').innerHTML = '<div class="text-center p-8 font-black text-red-500">Error connecting to database.</div>';
            })
            .withSuccessHandler(function (res) {
                window.stopQCTimer('Loaded', !res.success);

                if (!res.success) return alert(res.message);

                var parsedPayload = JSON.parse(res.payloadData);
                var blocksData = parsedPayload.blocks;
                var counts = parsedPayload.counts;
                window.existingOrd2Data = parsedPayload.existingOrd2 || {};
                window.cachedQCBlocksData = blocksData;

                document.getElementById('qc-count-total').innerText = counts.total;
                document.getElementById('qc-count-finished').innerText = counts.finished;
                document.getElementById('qc-count-pending').innerText = counts.pending;

                if (counts.total === 0) {
                    document.getElementById('qc-blocks-container').innerHTML = '<div class="text-center p-8 font-black text-xl text-slate-400">No pending deliveries found in DEL2.</div>';
                    window.checkTransferReady();
                    window.updateExceptionBadge();
                    return;
                }

                window.populateQCFilters(blocksData);
                window.renderQCDashboard(blocksData);
                window.updateExceptionBadge();

                for (var blockId in blocksData) window.updateBlockMath(blockId, true);
                for (var blockId in blocksData) {
                    if (blocksData[blockId].isBlockVerified) {
                        if (!window.selectedBlocks.includes(blockId)) { window.selectedBlocks.push(blockId); }
                    }
                }

                window.sortBlocks();
                window.checkTransferReady();
            }).getPendingDeliveriesDEL2();
    };

    window.requestEodPin = function() {
        var btn = document.getElementById('btn-generate-otp');
        if(!btn) btn = event.currentTarget; 
        var originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Generating...';
        btn.disabled = true;
        
        if (!window.activeAdminSession || !window.activeAdminSession.mailid) {
            btn.innerHTML = originalText;
            btn.disabled = false;
            alert("Session error: No active admin email found. Please log in again.");
            return;
        }
        
        var adminEmail = window.activeAdminSession.mailid;
        
        window.startQCTimer('Generating PIN');
        
        google.script.run.withSuccessHandler(function(res) {
            btn.innerHTML = originalText;
            btn.disabled = false;
            window.stopQCTimer('Generated', !res.success);
            
            if(res.success) {
                alert("🔐 EOD Handshake PIN generated:\n\n" + res.pin + "\n\nProvide this single-use PIN to the driver to complete their shift.");
            } else {
                alert("Error generating PIN: " + res.message);
            }
        }).withFailureHandler(function(err) {
            btn.innerHTML = originalText;
            btn.disabled = false;
            window.stopQCTimer('Failed', true);
            alert("Server Error: " + err.message);
        }).generateManagerEodPin(adminEmail);
    };

    window.executeTransferToSales = function () {
        var btn = document.getElementById('btn-transfer-sales');
        var payload = { blocks: [] };

        if (window.selectedBlocks.length === 0) return alert("Select at least one verified block to transfer.");

        window.selectedBlocks.forEach(blockId => {
            var block = document.querySelector('.qc-block-group[data-block-id="' + blockId + '"]');
            if (!block) return;

            var xF = parseInt(block.querySelector('.qc-var-xf').value) || 0;
            var sF = parseInt(block.querySelector('.qc-var-sf').value) || 0;
            var xE = parseInt(block.querySelector('.qc-var-xe').value) || 0;
            var sE = parseInt(block.querySelector('.qc-var-se').value) || 0;

            var blockData = {
                fullVar: xF - sF, empVar: xE - sE,
                reason: block.querySelector('.qc-var-reason').value || "Verified",
                v2bF: parseInt(block.querySelector('.qc-inp-v2bf').value) || 0,
                b2vF: parseInt(block.querySelector('.qc-inp-b2vf').value) || 0,
                b2vE: parseInt(block.querySelector('.qc-inp-b2ve').value) || 0,
                doors: []
            };

            block.querySelectorAll('.qc-door-row').forEach(row => {
                var doorUnique = null;
                var rIdx = parseInt(row.getAttribute('data-row-idx'));
                var rollVal = false;
                
                if (rIdx > 0 && window.cachedQCBlocksData[blockId]) {
                    var cachedDoor = window.cachedQCBlocksData[blockId].doors.find(d => d.sheetRow === rIdx);
                    if (cachedDoor) {
                        doorUnique = cachedDoor.uniqueNo;
                        rollVal = cachedDoor.rollover;
                    }
                }

                var elRepVj = row.querySelector('.qc-inp-actrep-vj');
                var elRepNvj = row.querySelector('.qc-inp-actrep-nvj');

                blockData.doors.push({
                    uniqueNo: doorUnique,
                    dvj: parseInt(row.querySelector('.qc-inp-actd-vj').value) || 0,
                    dnvj: parseInt(row.querySelector('.qc-inp-actd-nvj').value) || 0,
                    evj: parseInt(row.querySelector('.qc-inp-acte-vj').value) || 0,
                    envj: parseInt(row.querySelector('.qc-inp-acte-nvj').value) || 0,
                    repVj: elRepVj ? parseInt(elRepVj.value) || 0 : 0,
                    repNvj: elRepNvj ? parseInt(elRepNvj.value) || 0 : 0,
                    rollover: rollVal
                });

            });
            payload.blocks.push(blockData);
        });

        if (confirm("Execute batch sync for " + window.selectedBlocks.length + " selected block(s)?")) {
            btn.innerText = "Syncing Database..."; btn.disabled = true;
            
            window.startQCTimer('Syncing');
            
            google.script.run.withSuccessHandler(function (res) {

                if (res.success) {
                    window.stopQCTimer('Synced', false);
                    alert(res.message || "Sync successful!");
                    window.loadDeliveryQCData();
                } else if (res.errorType === "COLLISION" || (res.message && res.message.includes("aborted due to ORD2 conflict"))) {
                    window.stopQCTimer('Blocked', true);
                    window.existingOrd2Data = window.existingOrd2Data || {};
                    if (res.collisionData) {
                        for (var cpn in res.collisionData) {
                            window.existingOrd2Data[String(cpn).trim().toUpperCase()] = res.collisionData[cpn];
                        }
                    }

                    window.checkTransferReady();
                    window.openExceptionReview();

                    setTimeout(function () {
                        alert("⚠️ LIVE COLLISION DETECTED!\n\nA customer placed a new order while you were reviewing. The database transfer was aborted to protect your data.\n\nPlease toggle Rollover to NO for the highlighted customers in the Exception menu.");
                    }, 200);

                } else {
                    window.stopQCTimer('Failed', true);
                    alert("Error: " + res.message);
                    window.checkTransferReady();
                }
            }).withFailureHandler(function(err) {
                window.stopQCTimer('Failed', true);
                alert("Server connection failed: " + err.message);
                window.checkTransferReady();
            }).executeSecureTransferToSales(payload);
        }
    };

    window.openExceptionReview = function() {
        var container = document.getElementById('exception-table-container');
        var headerHTML = '<table class="w-full text-left border-collapse"><thead class="bg-amber-100 text-amber-900 text-[10px] uppercase tracking-widest sticky top-0 shadow-sm z-10"><tr><th class="p-4 border-b border-amber-200">Location</th><th class="p-4 border-b border-amber-200 text-center">Ordered (Ord)</th><th class="p-4 border-b border-amber-200 text-center">Actual Delivered (Act)</th><th class="p-4 border-b border-amber-200 text-center">Shortage</th><th class="p-4 border-b border-amber-200">Driver Note / Exception</th><th class="p-4 border-b border-amber-200 text-center">Rollover / Status</th></tr></thead><tbody class="divide-y divide-slate-200 text-xs">';
        
        var varianceRowsHtml = '';
        var infoRowsHtml = '';
        var count = 0;
        var collisionCpns = []; 

        for (var blockId in window.cachedQCBlocksData) {
            var block = window.cachedQCBlocksData[blockId];
            block.doors.forEach(d => {
                var state = window.getDoorExceptionState(d);
                
                if (state.isException) {
                    count++;
                    var chk = d.rollover ? 'checked' : '';
                    var actD = d.dvj + d.dnvj;
                    var actE = d.evj + d.envj;
                    
                    var reqRep = d.replaceQty || 0;
                    var actRep = (d.repVj || 0) + (d.repNvj || 0);
                    
                    var isZeroActualAndZeroOrdered = (d.ordD === 0 && actD === 0 && d.ordE === 0 && actE === 0 && reqRep === 0 && actRep === 0);
                    var isCancelled = state.cleanComment.includes("[CANCELLED");

                    var hasOrd2Collision = false;
                    var ord2Details = null;

                    var cleanCpn = String(d.cpn).trim().toUpperCase();

                    if (state.isShort && d.rollover && window.existingOrd2Data && window.existingOrd2Data[cleanCpn]) {
                        hasOrd2Collision = true;
                        ord2Details = window.existingOrd2Data[cleanCpn];
                        if (!collisionCpns.includes(cleanCpn)) collisionCpns.push(cleanCpn);
                    }

                    var ordStr = '<span class="font-black text-slate-700 block">' + d.ordD + ' Full</span><span class="text-slate-500 font-bold block">' + d.ordE + ' Emp</span>';
                    if (reqRep > 0) ordStr += '<span class="text-amber-600 font-black block mt-1">+' + reqRep + ' Rep</span>'; 

                    var actStr = '';
                    if (actD === 0 && actE === 0 && actRep === 0) {
                        actStr = '<span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-black inline-block">0 Delivered</span>';
                    } else {
                        actStr = '<span class="font-black text-emerald-700 block">' + actD + ' Full</span><span class="text-emerald-600 font-bold block">' + actE + ' Emp</span>';
                        if (reqRep > 0 || actRep > 0) actStr += '<span class="text-amber-600 font-black block mt-1">+' + actRep + ' Rep</span>'; 
                    }

                    var shortageStr = '';
                    if (d.ordD > actD) shortageStr += '<span class="text-rose-600 font-black block">-' + (d.ordD - actD) + ' Full</span>';
                    if (d.ordE > actE) shortageStr += '<span class="text-rose-600 font-black block">-' + (d.ordE - actE) + ' Emp</span>';
                    if (reqRep > actRep) shortageStr += '<span class="text-rose-600 font-black block">-' + (reqRep - actRep) + ' Rep</span>'; 
                    if (!state.isShort) shortageStr = '<span class="text-slate-400 font-bold">None</span>';

                    var cmtStr = state.cleanComment ? '<span class="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1.5 rounded text-[10px] font-black uppercase shadow-sm inline-block">' + state.cleanComment + '</span>' : '<span class="text-slate-400 italic">No note provided</span>';

                    var actionCell = '';
                    if (isZeroActualAndZeroOrdered) {
                        actionCell = '<span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded border border-slate-200">Zero Activity</span>';
                    } else if (isCancelled) {
                        actionCell = '<span class="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Cancelled</span>';
                    } else if (state.isShort) {
                        actionCell = '<label class="relative inline-flex items-center cursor-pointer" title="Toggle sending this shortage to tomorrow\'s route">' +
                                     '<input type="checkbox" class="sr-only peer" ' + chk + ' onchange="window.toggleRolloverLive(\'' + blockId + '\', \'' + d.uniqueNo + '\', this)">' +
                                     '<div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>' +
                                     '</label>' +
                                     '<span class="block text-[8px] text-slate-400 mt-1.5 font-black uppercase tracking-widest h-3 save-status-' + d.uniqueNo + '"></span>';
                    } else {
                        actionCell = '<span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Shortage</span>';
                    }

                    var collisionBadge = '';
                    if (hasOrd2Collision) {
                        collisionBadge = '<div id="badge-' + d.uniqueNo + '" class="mt-3 bg-rose-600 text-white text-[10px] p-2 rounded uppercase font-black tracking-widest shadow-md border border-rose-800">⚠️ ORD2 CONFLICT<br><span class="text-[9px] font-bold text-rose-200">Pending Order: ' + ord2Details.ordD + 'F / ' + ord2Details.ordE + 'E</span><br>👉 DISABLE ROLLOVER</div>';
                    }
                    var rowClass = hasOrd2Collision ? 'bg-rose-100 hover:bg-rose-200 border-l-4 border-rose-600 transition' : 'hover:bg-amber-50/50 transition';

                    var rowHtml = '<tr id="exc-row-' + d.uniqueNo + '" class="' + rowClass + '">' +
                            '<td class="p-4 border-b border-slate-200/50"><p class="font-black text-slate-800 text-sm">' + block.apartment + ' - ' + block.blockName + '</p><p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Door ' + d.doorNo + ' • <span class="text-blue-500">' + d.cpn + '</span></p>' + collisionBadge + '</td>' +
                            '<td class="p-4 text-center border-b border-slate-200/50 bg-slate-50/50">' + ordStr + '</td>' +
                            '<td class="p-4 text-center border-b border-slate-200/50">' + actStr + '</td>' +
                            '<td class="p-4 text-center border-b border-slate-200/50 bg-rose-50/30">' + shortageStr + '</td>' +
                            '<td class="p-4 border-b border-slate-200/50">' + cmtStr + '</td>' +
                            '<td class="p-4 text-center border-b border-slate-200/50">' + actionCell + '</td>' +
                            '</tr>';

                    if (state.hasVariance) varianceRowsHtml += rowHtml;
                    else infoRowsHtml += rowHtml;
                }
            });
        }

        var footerHtml = '</tbody></table>';
        var topBanner = '';
        if (collisionCpns.length > 0) {
            topBanner = '<div class="bg-rose-100 p-4 border-b-4 border-rose-300 flex items-start gap-4 z-20 shadow-sm relative"><div class="text-4xl animate-pulse">🚨</div><div><h4 class="font-black text-rose-800 text-lg uppercase tracking-widest leading-tight">Action Required: Rollover Conflicts Detected</h4><p class="text-rose-700 text-xs font-bold mt-1">The highlighted customers already have a pending order in ORD2. You must manually toggle their Rollover switch to <span class="bg-rose-200 px-2 py-0.5 rounded text-rose-900 border border-rose-300">NO</span> below.</p></div></div>';
        }

        if (count === 0) {
            container.innerHTML = '<div class="p-16 text-center"><div class="text-5xl mb-4">🌟</div><p class="text-lg font-black text-slate-400 uppercase tracking-widest">No exceptions or shortages found</p></div>';
        } else {
            container.innerHTML = topBanner + headerHTML + varianceRowsHtml + infoRowsHtml + footerHtml;
        }
        document.getElementById('admin-exception-modal').classList.remove('hidden');
    };

    window.toggleRolloverLive = function (blockId, uniqueNo, checkbox) {
        var isChecked = checkbox.checked;
        var statusEl = document.querySelector('.save-status-' + uniqueNo);
        statusEl.innerText = 'SAVING...';
        statusEl.className = 'block text-[8px] text-amber-600 mt-1.5 font-black uppercase tracking-widest h-3 animate-pulse save-status-' + uniqueNo;
        checkbox.disabled = true;

        google.script.run.withSuccessHandler(function (res) {
            checkbox.disabled = false;
            if (res.success) {
                var bData = window.cachedQCBlocksData[blockId];
                if (bData) {
                    var door = bData.doors.find(d => d.uniqueNo === uniqueNo);
                    if (door) door.rollover = isChecked;
                }
                statusEl.innerText = 'SAVED';
                statusEl.className = 'block text-[8px] text-emerald-600 mt-1.5 font-black uppercase tracking-widest h-3 save-status-' + uniqueNo;
                setTimeout(function () { statusEl.innerText = ''; }, 2000);

                if (!isChecked) {
                    var rowEl = document.getElementById('exc-row-' + uniqueNo);
                    if (rowEl) {
                        rowEl.classList.remove('bg-rose-100', 'hover:bg-rose-200', 'border-l-4', 'border-rose-600');
                        rowEl.classList.add('hover:bg-amber-50/50');
                    }
                    var badgeEl = document.getElementById('badge-' + uniqueNo);
                    if (badgeEl) badgeEl.style.display = 'none';
                }

            } else {
                checkbox.checked = !isChecked;
                statusEl.innerText = 'FAILED';
                statusEl.className = 'block text-[8px] text-rose-600 mt-1.5 font-black uppercase tracking-widest h-3 save-status-' + uniqueNo;
                alert("Could not save to database: " + res.message);
            }
        }).withFailureHandler(function (err) {
            checkbox.disabled = false;
            checkbox.checked = !isChecked;
            statusEl.innerText = 'NET ERROR';
            statusEl.className = 'block text-[8px] text-rose-600 mt-1.5 font-black uppercase tracking-widest h-3 save-status-' + uniqueNo;
        }).adminToggleRolloverStatus(uniqueNo, isChecked);
    };

    window.populateQCFilters = function (blocksData) {
        var aptSelect = document.getElementById('qc-flt-apt');
        var apts = new Set();
        for (var key in blocksData) apts.add(blocksData[key].apartment);
        var sortedApts = Array.from(apts).sort();
        aptSelect.innerHTML = '<option value="ALL">ALL APARTMENTS</option>';
        sortedApts.forEach(apt => aptSelect.innerHTML += '<option value="' + apt + '">' + apt + '</option>');
        window.updateQCBlockDropdown();
    };

    window.updateQCBlockDropdown = function () {
        var selApt = document.getElementById('qc-flt-apt').value;
        var blkSelect = document.getElementById('qc-flt-blk');
        var blks = new Set();
        for (var key in window.cachedQCBlocksData) {
            if (selApt === "ALL" || window.cachedQCBlocksData[key].apartment === selApt) {
                blks.add(window.cachedQCBlocksData[key].blockName);
            }
        }
        var sortedBlks = Array.from(blks).sort();
        blkSelect.innerHTML = '<option value="ALL">ALL BLOCKS</option>';
        sortedBlks.forEach(blk => blkSelect.innerHTML += '<option value="' + blk + '">' + blk + '</option>');
        window.applyQCFilter();
    };

    window.setStatusFilter = function (status) {
        window.currentStatusFilter = status;
        ['all', 'pend', 'fin'].forEach(id => {
            var btn = document.getElementById('btn-flt-' + id);
            btn.className = "flex-1 text-[10px] md:text-xs font-black py-2.5 rounded-lg text-slate-500 hover:text-slate-800 transition tracking-widest uppercase";
        });
        var activeId = status === 'ALL' ? 'all' : (status === 'PENDING' ? 'pend' : 'fin');
        document.getElementById('btn-flt-' + activeId).className = "flex-1 text-[10px] md:text-xs font-black py-2.5 rounded-lg bg-white text-slate-800 shadow-sm transition tracking-widest uppercase";
        document.getElementById('qc-select-all-chk').checked = false;
        window.applyQCFilter();
    };

    window.applyQCFilter = function () {
        var selApt = document.getElementById('qc-flt-apt').value;
        var selBlk = document.getElementById('qc-flt-blk').value;
        var selExc = document.getElementById('qc-flt-exc') ? document.getElementById('qc-flt-exc').value : "ALL";

        document.querySelectorAll('.qc-block-group').forEach(block => {
            var blockId = block.getAttribute('data-block-id');
            var bData = window.cachedQCBlocksData[blockId];
            var matchApt = (selApt === "ALL" || bData.apartment === selApt);
            var matchBlk = (selBlk === "ALL" || bData.blockName === selBlk);
            var matchStatus = true;
            if (window.currentStatusFilter === 'PENDING') matchStatus = !bData.isBlockVerified;
            if (window.currentStatusFilter === 'VERIFIED') matchStatus = bData.isBlockVerified;
            
            var matchExc = true;
            if (selExc === "EXCEPTIONS") {
                matchExc = false; 
                bData.doors.forEach(d => {
                    var state = window.getDoorExceptionState(d);
                    if (state.isException) matchExc = true;
                });
            }

            if (matchApt && matchBlk && matchStatus && matchExc) block.style.display = "";
            else block.style.display = "none";
        });
    };

    window.initLightbox = function () {
        if (document.getElementById('qc-lightbox')) return;
        var lb = document.createElement('div');
        lb.id = 'qc-lightbox';
        lb.className = 'fixed inset-0 z-[100] bg-slate-900/95 hidden flex flex-col items-center justify-center backdrop-blur-sm transition-opacity opacity-0';
        lb.innerHTML = '<div class="absolute top-4 right-4 flex gap-4 z-50"><button onclick="window.resetZoom()" class="bg-white/10 text-white font-bold px-4 py-2 rounded-lg hover:bg-white/20 transition">Reset Zoom</button><button onclick="window.closeLightbox()" class="bg-red-500 text-white font-black px-4 py-2 rounded-lg hover:bg-red-600 transition shadow-lg">CLOSE [X]</button></div><div id="lb-img-container" class="relative w-full h-full overflow-hidden cursor-grab flex items-center justify-center touch-none"><img id="lb-img" class="max-w-full max-h-full object-contain transition-transform duration-75 origin-center select-none shadow-2xl"></div><p class="absolute bottom-6 text-slate-400 font-bold text-sm bg-slate-900/50 px-4 py-2 rounded-xl pointer-events-none">Pinch to Zoom &bull; Drag to Pan</p>';
        document.body.appendChild(lb);

        var container = document.getElementById('lb-img-container');
        window.lbScale = 1; window.lbPointX = 0; window.lbPointY = 0;
        var isDragging = false, startX, startY;
        var initialPinchDistance = null, initialScale = 1;

        container.onwheel = function (e) {
            e.preventDefault(); window.lbScale += (e.deltaY < 0 ? 1 : -1) * 0.1;
            if (window.lbScale < 0.5) window.lbScale = 0.5;
            if (window.lbScale > 5) window.lbScale = 5;
            window.applyZoomPan();
        };

        container.onmousedown = function (e) {
            e.preventDefault(); isDragging = true; container.classList.replace('cursor-grab', 'cursor-grabbing');
            startX = e.clientX - window.lbPointX; startY = e.clientY - window.lbPointY;
        };
        container.onmousemove = function (e) {
            if (!isDragging) return;
            window.lbPointX = e.clientX - startX; window.lbPointY = e.clientY - startY; window.applyZoomPan();
        };
        container.onmouseup = function (e) { isDragging = false; container.classList.replace('cursor-grabbing', 'cursor-grab'); };
        container.onmouseleave = function (e) { isDragging = false; container.classList.replace('cursor-grabbing', 'cursor-grab'); };

        container.ontouchstart = function (e) {
            if (e.touches.length === 1) {
                isDragging = true; startX = e.touches[0].clientX - window.lbPointX; startY = e.touches[0].clientY - window.lbPointY;
            } else if (e.touches.length === 2) {
                isDragging = false;
                initialPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                initialScale = window.lbScale;
            }
        };

        container.ontouchmove = function (e) {
            e.preventDefault();
            if (isDragging && e.touches.length === 1) {
                window.lbPointX = e.touches[0].clientX - startX; window.lbPointY = e.touches[0].clientY - startY;
                window.applyZoomPan();
            } else if (e.touches.length === 2 && initialPinchDistance) {
                var currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                var zoomFactor = currentDistance / initialPinchDistance;
                window.lbScale = initialScale * zoomFactor;
                if (window.lbScale < 0.5) window.lbScale = 0.5;
                if (window.lbScale > 5) window.lbScale = 5;
                window.applyZoomPan();
            }
        };

        container.ontouchend = function (e) { isDragging = false; initialPinchDistance = null; };
    };

    window.applyZoomPan = function () {
        var img = document.getElementById('lb-img');
        if (img) img.style.transform = 'translate(' + window.lbPointX + 'px, ' + window.lbPointY + 'px) scale(' + window.lbScale + ')';
    };

    window.resetZoom = function () { window.lbScale = 1; window.lbPointX = 0; window.lbPointY = 0; window.applyZoomPan(); };

    window.openLightbox = function (url) {
        if (!url || url.trim() === "") return alert("No photo provided.");
        window.initLightbox();
        document.getElementById('lb-img').src = window.parseImgUrl(url);
        window.resetZoom();
        var lb = document.getElementById('qc-lightbox');
        lb.classList.remove('hidden');
        setTimeout(function () { lb.classList.remove('opacity-0'); }, 10);
    };

    window.closeLightbox = function () {
        var lb = document.getElementById('qc-lightbox');
        lb.classList.add('opacity-0');
        setTimeout(function () { lb.classList.add('hidden'); }, 300);
    };

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            var lb = document.getElementById('qc-lightbox');
            if (lb && !lb.classList.contains('hidden')) window.closeLightbox();
        }
    });

    window.scrollAdminTo = function (pos) {
        var topVal = (pos === 'top') ? 0 : 999999;
        window.scrollTo({ top: topVal, behavior: 'smooth' });
        document.documentElement.scrollTo({ top: topVal, behavior: 'smooth' });
        document.body.scrollTo({ top: topVal, behavior: 'smooth' });
        var scrollables = document.querySelectorAll('main, .overflow-y-auto');
        scrollables.forEach(function (el) {
            el.scrollTo({ top: (pos === 'top') ? 0 : el.scrollHeight, behavior: 'smooth' });
        });
    };
