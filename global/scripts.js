(function(){
  var i,e,d=document,s="script";i=d.createElement("script");i.async=1;i.charset="UTF-8";
  i.src="https://cdn.curator.io/published/41ac22fb-1cfa-42ef-9b66-90aca1f9988d.js";
  e=d.getElementsByTagName(s)[0];e.parentNode.insertBefore(i, e);
})();

window.onscroll = function() {scrollFunction()};

function scrollFunction() {
  if (document.body.scrollTop > 60 || document.documentElement.scrollTop > 60) {
    document.getElementById("toppy").style.padding = "0"
    document.getElementById("toppy").style.background = "rgba(31,33,33,0.75)"
    document.getElementById("toppy").style.borderBottom = "1px solid #f5d53d"
  }
  else {
    document.getElementById("toppy").style.padding = "30px 0";
    document.getElementById("toppy").style.background = "#1f2121"
    document.getElementById("toppy").style.borderBottom = "none"
  }
}