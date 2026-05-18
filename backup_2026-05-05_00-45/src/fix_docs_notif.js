import fs from 'fs';
let code = fs.readFileSync('src/app.jsx', 'utf8');

const oldStr = `{documents.filter(d => !d.signed_at).length > 0 && (`
const newStr = `{(documents || []).filter(d => !d.signed_at && d.workerId === currentUser?.id).length > 0 && (`

if (code.includes(oldStr)) {
    code = code.replace(oldStr, newStr);
    console.log("Success! Updated pending documents notification logic.");
    fs.writeFileSync('src/app.jsx', code);
} else {
    console.log("Could not find the string to replace.");
}
