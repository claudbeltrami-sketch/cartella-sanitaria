/* Local backup JSON I/O. No network or persistence; the V1 format is unchanged. */
import { JSONParser } from '@streamparser/json';

async function read(file, decodeBlob, progress = () => {}) {
  if (file.size < 64 * 1024 * 1024) return JSON.parse(await file.text());
  const packet = Object.create(null);
  const paths = ['$.*', '$.contenuto.originali.*'];
  const parser = new JSONParser({ paths, keepStack: false, stringBufferSize: 64 * 1024 });
  parser.onValue = ({ value, key, stack }) => {
    if (stack.length === 3 && stack[1]?.key === 'contenuto' && stack[2]?.key === 'originali') {
      if (value && value.blob) value.blob = decodeBlob(value.blob, value.type);
    } else if (stack.length === 1) packet[key] = value;
  };
  // Blob slices also work in browsers without File.stream(). Each token is
  // bounded by one attachment, never by the size of the entire archive.
  const chunk = 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunk) {
    parser.write(new Uint8Array(await file.slice(offset, offset + chunk).arrayBuffer()));
    progress(Math.min(100, Math.round((offset + chunk) / file.size * 100)));
  }
  if (!parser.isEnded) parser.end();
  return packet;
}

function toFile(packet, name) {
  if (packet?.tipo !== 'BELTRAMI_BACKUP_COMPLETO_V1')
    return new File([JSON.stringify(packet, null, 2)], name, { type: 'application/json' });
  const parts = ['{'];
  Object.entries(packet).forEach(([key, value], index) => {
    if (index) parts.push(',');
    parts.push(JSON.stringify(key), ':');
    if (key !== 'contenuto') { parts.push(JSON.stringify(value)); return; }
    parts.push('{');
    Object.entries(value).forEach(([field, data], fieldIndex) => {
      if (fieldIndex) parts.push(',');
      parts.push(JSON.stringify(field), ':');
      if (field !== 'originali') { parts.push(JSON.stringify(data)); return; }
      parts.push('[');
      data.forEach((row, rowIndex) => {
        if (rowIndex) parts.push(',');
        parts.push(JSON.stringify(row));
      });
      parts.push(']');
    });
    parts.push('}');
  });
  parts.push('}');
  return new File(parts, name, { type: 'application/json' });
}
window.lumenBackupIO = { read, toFile };
