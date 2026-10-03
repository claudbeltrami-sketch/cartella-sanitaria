// Serve the actual application assets, including newly added local scripts.
// The browser tests separately block requests outside this server's origin.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
module.exports=function localServer(root){
 return http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  const file=path.resolve(root,name);
  if(!file.startsWith(root+path.sep)||name.split('/').some(p=>p.startsWith('.'))||!['.html','.js','.css'].includes(path.extname(file))||!fs.existsSync(file)||!fs.statSync(file).isFile()){
   res.writeHead(404);return res.end();
  }
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
 });
};
