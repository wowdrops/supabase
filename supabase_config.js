// Supabase Client Initialization
    const SUPABASE_URL = 'https://vzhnypcrckrngwaugwkq.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6aG55cGNyY2tybmd3YXVnd2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NjU2NjQsImV4cCI6MjEwNzI0MTY2NH0.qCjMlyvtwxPBSZ16ifJeJwcOI-TtX5YETU71ekzEHaM';
    window.supabase1 = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const GAS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxGjQDZmL6jfJebCNt8UGFwi6svY4nxDBIJEYRTejb-cCetktkl-yNrF8lbW_WAwJE/exec"; // project in script.google.com 
    const IMGBB_API_KEY = "cff2fdf9d4e5b567d42e947d309a1b84";  // REPLACE THIS WITH YOUR FREE IMGBB API KEY (from api.imgbb.com)// logged in using google acc wowdropschennai@gmail.com to get free API


// Temporary safety bridge while migrating from GAS to Supabase
if (typeof google === 'undefined') {
  window.google = {
    script: {
      run: new Proxy({}, {
        get(target, prop) {
          if (prop === 'withSuccessHandler' || prop === 'withFailureHandler') {
            return () => window.google.script.run;
          }
          return (...args) => {
            console.warn(`⚠️ [GAS Migration Pending] "${prop}" was called with:`, args);
          };
        }
      })
    }
  };
}