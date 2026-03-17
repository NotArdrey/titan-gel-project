const fs = require('fs');
const glob = require('fs').readdirSync('views').filter(f => f.endsWith('.html'));

glob.forEach(f => {
  let content = fs.readFileSync('views/' + f, 'utf8');
  let pattern = /<div class="flex items-center">\s*(<a [^>]+>[\s\S]*?<\/a>)\s*<div class="hidden 2xl:ml-6 2xl:flex 2xl:space-x-4">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="hidden 2xl:flex 2xl:items-center 2xl:space-x-4"><\/div>/;
  
  let matches = content.match(pattern);
  if (matches) {
    let replaced = content.replace(pattern, 
      '<div class="flex items-center">\n          ' + matches[1] + '\n        </div>\n        <div class="hidden 2xl:ml-6 2xl:flex 2xl:flex-1 2xl:justify-end 2xl:items-center 2xl:space-x-4">\n          ' + matches[2] + '\n        </div>'
    );
    fs.writeFileSync('views/' + f, replaced);
    console.log('Updated ' + f);
  } else {
    console.log('No match in ' + f);
  }
});
