(function(){
  var i,e,d=document,s="script";i=d.createElement("script");i.async=1;i.charset="UTF-8";
  i.src="https://cdn.curator.io/published/41ac22fb-1cfa-42ef-9b66-90aca1f9988d.js";
  e=d.getElementsByTagName(s)[0];e.parentNode.insertBefore(i, e);
  })();

/* Toggle between adding and removing the "responsive" class to topnav when the user clicks on the icon */
function hamburgerify() {
  var x = document.getElementById("links");
  if (x.className === "links") {
    x.className += " responsive";
  } else {
    x.className = "links";
  }
}