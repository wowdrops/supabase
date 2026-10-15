
  window.loadSystemAccessMap = function() {
    var grid = document.getElementById('access-grid');
    var loading = document.getElementById('access-loading');
    
    grid.innerHTML = "";
    loading.classList.remove('hidden');

    google.script.run.withSuccessHandler(function(res) {
      loading.classList.add('hidden');
      if (!res.success) return alert(res.message);
      
      var users = res.users;
      if (!users || users.length === 0) {
        grid.innerHTML = "<div class='col-span-full text-center text-slate-400 font-bold text-xl py-12'>No users found in master register.</div>";
        return;
      }

      var html = "";
      for (var i = 0; i < users.length; i++) {
        var u = users[i];
        
        // Dynamic Role Badge Colors
        var roleBadgeClass = "bg-slate-100 text-slate-700 border-slate-300";
        if (u.role === "Super Admin") roleBadgeClass = "bg-purple-100 text-purple-800 border-purple-300";
        else if (u.role === "Admin") roleBadgeClass = "bg-indigo-100 text-indigo-800 border-indigo-300";

        html += "<div class='bg-white p-6 rounded-3xl border-4 border-slate-200 shadow-xl flex flex-col justify-between'>";
        
        // Card Top: User Details & Role Badge
        html += "<div>";
        html += "<div class='flex justify-between items-start gap-2 mb-4'>";
        html += "<div><h3 class='text-2xl font-black text-slate-800'>" + u.username + "</h3>";
        html += "<p class='text-xs font-bold text-slate-400 mt-0.5'>" + u.mailid + " • " + u.phone + "</p></div>";
        html += "<span class='px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest border-2 " + roleBadgeClass + "'>" + u.role + "</span>";
        html += "</div>";

        // Divider
        html += "<div class='border-t-2 border-slate-100 my-4'></div>";

        // Permitted Submenus Title
        html += "<p class='text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3'>Permitted Submenus (" + u.permissions.length + ")</p>";
        
        // Permission Badges Container
        html += "<div class='flex flex-wrap gap-1.5 mb-4'>";
        for (var p = 0; p < u.permissions.length; p++) {
          var tag = u.permissions[p];
          var tagStyle = tag.includes("Full Universal Access") 
            ? "bg-purple-600 text-white font-black px-3 py-1.5 text-xs rounded-lg shadow-sm w-full text-center" 
            : "bg-slate-100 text-slate-700 font-bold px-2.5 py-1 text-xs rounded-lg border border-slate-200";
          
          html += "<span class='" + tagStyle + "'>" + tag + "</span>";
        }
        html += "</div>";
        
        html += "</div>"; // End card top block
        html += "</div>"; // End card container
      }

      grid.innerHTML = html;
    }).getSystemAccessMapData();
  };
