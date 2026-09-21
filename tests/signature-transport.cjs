// Real bundled PeerJS serializers; only the network/RTC wire is simulated.
// No patient data, public signaling service, or browser installation is needed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
class RTC {
  createDataChannel(){return {bufferedAmount:0,addEventListener(){},close(){}};}
  createOffer(){return new Promise(()=>{});}
  close(){}
}
const c={window:{location:{protocol:'https:',hostname:'example.test'}},navigator:{userAgent:'serializer-test',platform:'test'},
  console,TextEncoder,TextDecoder,URL,Blob,ArrayBuffer,Uint8Array,DataView,Promise,
  RTCPeerConnection:RTC,setTimeout:()=>0,clearTimeout(){},fetch:()=>new Promise(()=>{})};
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/peerjs-1.5.4.min.js'),'utf8'),c);
const peer=new c.window.Peer();peer.on('error',()=>{});
const serializers=peer._serializers;
const provider={options:{config:{}},socket:{send(){}},emitError(type,e){throw e},_removeConnection(){}};
function transfer(mode,packet){
  const sender=new serializers[mode]('MAC',provider,{reliable:true});
  const receiver=new serializers[mode]('IPHONE',provider,{reliable:true});
  let result,error,frames=0,maxFrame=0;
  sender.on('error',e=>{error=e});receiver.on('data',d=>{result=d});
  sender.dataChannel.send=bytes=>{frames++;maxFrame=Math.max(maxFrame,bytes.byteLength);receiver._handleDataMessage({data:bytes});};
  // Construct input in the library's realm, as in the browser.
  c.wirePacket=JSON.stringify(packet);
  sender.dataChannel.onopen();receiver.dataChannel.onopen();sender.send(vm.runInContext('JSON.parse(wirePacket)',c));
  return {result,error,frames,maxFrame};
}
const chosen=html.match(/peer\.connect\(targetPeerId,\{reliable:true,serialization:'([^']+)'\}/)[1];
for(const bytes of [62*1024,132*1024,512*1024]){
  const packet={tipo:'BELTRAMI_FIRMA_IPHONE_V1',versione:2,id:'TEST_TRANSPORT',visita:'2026-09-28',identita:'TEST_ONLY',
    cognome:'PROVA',nome:'TRASPORTO',firma_lavoratore_png:'data:image/png;base64,'+'QUJD'.repeat(bytes/4)};
  const old=transfer('json',packet);
  assert.match(old.error?.message||'',/Message too big/);assert.equal(old.frames,0);
  const actual=transfer(chosen,packet);
  assert.equal(actual.error,undefined,`Selected ${chosen} transport must accept a ${bytes}-byte signature`);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.result)),packet);
  assert.ok(actual.frames>1);assert.ok(actual.maxFrame<17000);
  const ack={tipo:'BELTRAMI_FIRMA_RICEVUTA_V1',id:packet.id,ok:true};
  assert.deepEqual(JSON.parse(JSON.stringify(transfer(chosen,ack).result)),ack);
  console.log(`PASS: ${bytes}-byte signature, ${actual.frames} real PeerJS chunks, exact reassembly and acknowledgement.`);
}
