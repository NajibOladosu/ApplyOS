const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (f === 'node_modules' || f === '.git' || f === '.next') return;
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const replacements = [
  { from: /@\/lib\/supabase\/server/g, to: "@/shared/db/supabase/server" },
  { from: /@\/lib\/supabase\/client/g, to: "@/shared/db/supabase/client" },
  { from: /@\/lib\/ai\/model-manager/g, to: "@/shared/infrastructure/ai/model-manager" },
  { from: /@\/lib\/ai\/retry-queue/g, to: "@/shared/infrastructure/ai/retry-queue" },
  { from: /@\/lib\/ai/g, to: "@/shared/infrastructure/ai" },
  { from: /@\/lib\/utils/g, to: "@/shared/lib/utils" },
  { from: /@\/lib\/services\/analytics/g, to: "@/modules/analytics/services/analytics.service" },
  { from: /@\/lib\/services\/applications/g, to: "@/modules/applications/services/application.service" },
  { from: /@\/lib\/services\/documents/g, to: "@/modules/documents/services/document.service" },
  { from: /@\/lib\/services\/interviews/g, to: "@/modules/interviews/services/interview.service" },
  { from: /@\/lib\/services\/questions/g, to: "@/modules/interviews/services/question.service" },
  { from: /@\/lib\/services\/notes/g, to: "@/modules/notes/services/note.service" },
  { from: /@\/lib\/services\/conversation/g, to: "@/modules/interviews/services/conversation.service" },
];

walkDir('.', function(filePath) {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  replacements.forEach(r => {
    newContent = newContent.replace(r.from, r.to);
  });
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Fixed', filePath);
  }
});
