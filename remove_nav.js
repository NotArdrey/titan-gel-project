const fs = require('fs');
const files = fs.readdirSync('views').filter(f => f.endsWith('.html'));

files.forEach(f => {
  let content = fs.readFileSync('views/' + f, 'utf8');
  
  // Replace the exact HTML for the desktop nav links
  content = content.replace(/\s*<a href="privacy-disclaimer\.html" class="border-transparent[^"]+">Privacy Policy<\/a>/g, '');
  content = content.replace(/\s*<a href="terms\.html" class="border-transparent[^"]+">Terms & Conditions<\/a>/g, '');

  // Replace the exact HTML for the mobile drawer links
  content = content.replace(/\s*<a href="privacy-disclaimer\.html" class="block pl-3[^"]+">Privacy Policy<\/a>/g, '');
  content = content.replace(/\s*<a href="terms\.html" class="block pl-3[^"]+">Terms & Conditions<\/a>/g, '');

  fs.writeFileSync('views/' + f, content);
  console.log('Processed ' + f);
});
