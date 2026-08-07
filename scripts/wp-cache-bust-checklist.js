
const base=(process.env.WORDPRESS_URL||'https://cleexs.net').replace(/\/$/,'');
const auth=Buffer.from(process.env.WORDPRESS_USERNAME+':'+process.env.WORDPRESS_APP_PASSWORD).toString('base64');
const headers={Authorization:'Basic '+auth,'Content-Type':'application/json'};
const postUrl=base+'/articulos/checklist-seo/';

async function main(){
  // draft -> publish
  let r=await fetch(base+'/wp-json/wp/v2/posts/411',{method:'POST',headers,body:JSON.stringify({status:'draft'})});
  console.log('draft', r.status);
  await new Promise(s=>setTimeout(s,2000));
  r=await fetch(base+'/wp-json/wp/v2/posts/411',{method:'POST',headers,body:JSON.stringify({status:'publish'})});
  const pub=await r.json();
  console.log('publish', r.status, pub.modified, 'teoInRendered', (pub.content?.rendered||'').includes('teo.jpg'));

  // ensure content still has teo (re-push raw)
  const edit=await (await fetch(base+'/wp-json/wp/v2/posts/411?context=edit',{headers})).json();
  let raw=edit.content.raw;
  console.log('edit teo', raw.includes('teo.jpg'), 'len', raw.length);
  if(!raw.includes('<!--cleexs-bust-->')) raw += '\n<!--cleexs-bust-->';
  else raw = raw.replace('<!--cleexs-bust-->', `<!--cleexs-bust:${Date.now()}-->`);
  r=await fetch(base+'/wp-json/wp/v2/posts/411',{method:'POST',headers,body:JSON.stringify({content:raw, status:'publish'})});
  console.log('retouch', r.status);

  // PURGE attempts
  for (const method of ['PURGE','BAN']) {
    try {
      const pr=await fetch(postUrl,{method, headers:{...headers, 'X-LiteSpeed-Purge':'*'}});
      console.log(method, pr.status);
    } catch(e){ console.log(method, e.message); }
  }

  // Wait and check public
  for (const wait of [2,5,10]) {
    await new Promise(s=>setTimeout(s, wait*1000));
    const page=await (await fetch(postUrl+`?t=${Date.now()}`,{headers:{'Cache-Control':'no-cache'}})).text();
    const head=await fetch(postUrl,{method:'HEAD'});
    console.log(`after ${wait}s public teo=${page.includes('teo.jpg')} letterT=${/avatar">\s*T/.test(page)} cache=${head.headers.get('x-proxy-cache-info')}`);
    if(page.includes('teo.jpg')) break;
  }
}
main().catch(e=>{console.error(e); process.exit(1);});
