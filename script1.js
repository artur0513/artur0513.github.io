var c = document.getElementById('c1');
var gl = c.getContext('experimental-webgl');

async function loadData(){
let url = 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/fetch_test.txt';
let response = await fetch(url);
let text = await response.text(); // прочитать тело ответа как текст
alert(text.slice(0, 80) + '...');
}

loadData();

gl.clearColor(0,0,0.8,1);
gl.clear(gl.COLOR_BUFFER_BIT);