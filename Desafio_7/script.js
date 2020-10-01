const jsonFile = require('./data.json');
const fs = require('fs');
const converter = require('json-2-csv');

const allRows = Array.from(Array(17016), (_, i) => i + 1);
const uniqueRows = [];
const uniqueJson = [];

for(row of jsonFile) {
  if (uniqueRows.indexOf(row['row']) === -1) {
    uniqueRows.push(row['row']);
    uniqueJson.push(row);
  }
}

const remainingRows = allRows.filter(row => !uniqueRows.includes(row));

const sortedJson = uniqueJson.sort((a, b) => {
  if (parseInt(a["row"]) < parseInt(b["row"])) {
    return -1;
  }
  if (parseInt(a["row"]) > parseInt(b["row"])) {
    return 1;
  }
  return 0; 
});

const stringifiedJSON = sortedJson.map(row => {
  stringifiedRow = `\t${JSON.stringify(row)},\n`;
  return stringifiedRow;
});

stringifiedJSON[sortedJson.length - 1] = stringifiedJSON[sortedJson.length - 1].slice(0, -2);
stringifiedJSON.unshift('[\n');
stringifiedJSON.push('\n]');

fs.writeFile('teste_js.json', stringifiedJSON.join(''), (err, result) => {
  if(err) console.log('error', err);
});

converter.json2csv(sortedJson, (err, csv) => {
  if (err) console.log('error', err);
  fs.writeFileSync('teste_js.csv', csv);
});

console.log(uniqueRows.length);
console.log(remainingRows);
