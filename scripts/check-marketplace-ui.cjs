const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let pressed = false;
let fontsLoaded = false;
const react = {
  createContext: value => ({value}),
  useContext: () => fontsLoaded,
  forwardRef: fn => fn,
  useState: () => [pressed, value => { pressed = value; }],
  createElement: (type, props) => ({ type, props }),
};
const native = { Pressable: 'NativePressable', Text: 'NativeText', Platform: { OS: 'android' }, StyleSheet: { flatten: style => style } };
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  }}).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => name === 'react' ? react : native });
  return exports;
}
const { AppPressable } = load('mobile/src/components/AppPressable.tsx');
const layout = { flexDirection: 'row', backgroundColor: '#005C40', height: 44 };
let inCalls = 0, outCalls = 0;
const props = { style: ({pressed}) => [layout, {opacity: pressed ? 0.8 : 1}],
 onPressIn: () => inCalls++, onPressOut: () => outCalls++ };
let element = AppPressable(props, 'ref');
assert.equal(typeof element.props.style, 'object');
assert.equal(element.props.style[0], layout);
assert.equal(element.props.ref, 'ref');
element.props.onPressIn({});
element = AppPressable(props);
assert.equal(element.props.style[1].opacity, 0.8);
assert.equal(inCalls, 1);
element.props.onPressOut({});
assert.equal(outCalls, 1);
assert.equal(AppPressable(props).props.style[1].opacity, 1);
pressed = true;
assert.equal(AppPressable({...props, disabled:true}).props.style[1].opacity, 1);
assert.equal(AppPressable({style: layout}).props.style, layout);
const {AppText} = load('mobile/src/components/AppText.tsx');
const text = AppText({style:{fontWeight:'700'}, children:'Jobs near you', maxFontSizeMultiplier:2});
assert.equal(text.props.style[1].fontFamily, 'sans-serif');
assert.equal(text.props.style[0].fontWeight, '700');
assert.equal(text.props.maxFontSizeMultiplier, 2);
fontsLoaded = true;
assert.equal(AppText({style:{fontWeight:'700'}}).props.style[1].fontFamily, 'Bulao-Bold');
assert.equal(AppText({style:{fontWeight:'600'}}).props.style[1].fontFamily, 'Bulao-SemiBold');
assert.equal(AppText({style:{fontWeight:'400'}}).props.style[1].fontFamily, 'Bulao-Regular');
console.log('PASS: static layout delivery, pressed/released feedback, event forwarding, disabled state, ref forwarding, static styles, explicit font, weight and accessibility props.');
