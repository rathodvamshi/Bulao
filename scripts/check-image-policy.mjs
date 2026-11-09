import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'backend/scripts/app-assets.json'),'utf8'));
const ids=new Set(manifest.map(a=>a.id));
const failures=[];
const raster=/\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);if(entry.isDirectory()){walk(file);continue;}
  if(!/\.[jt]sx?$/.test(file))continue;
  const relative=path.relative(root,file).replaceAll('\\','/');
  const text=fs.readFileSync(file,'utf8');
  const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const fail=message=>failures.push(`${relative}: ${message}`);
  function visit(node){
    if(ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)){
      const module=node.moduleSpecifier.text;
      if(raster.test(module))fail('Publish artwork with pnpm images:add and use AppImage assetId.');
      if(module==='react-native' && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
        && node.importClause.namedBindings.elements.some(e=>['Image','ImageBackground'].includes((e.propertyName??e.name).text))) fail('Use AppImage for shared image caching and priority.');
      if(module==='expo-image' && !['mobile/src/components/AppImage.tsx','mobile/src/components/StoryHero.tsx'].includes(relative)) fail('Use AppImage; story playback owns its sequential loader.');
    }
    if(ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text==='require'
      && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && raster.test(node.arguments[0].text)) fail('Local screen image imports are not allowed. Publish the image first.');
    if(ts.isJsxAttribute(node) && node.name.getText(tree)==='assetId' && node.initializer && ts.isStringLiteral(node.initializer) && !ids.has(node.initializer.text)) fail(`Unknown assetId ${node.initializer.text}; publish/register it first.`);
    ts.forEachChild(node,visit);
  }
  visit(tree);
}}
walk(path.join(root,'mobile/src'));walk(path.join(root,'mobile/app'));
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log('Image policy passed: screen artwork uses the remote registry and shared loaders.');
