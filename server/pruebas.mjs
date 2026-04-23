const set = new Set();
set.add([32, 45]);
set.add([1, 2]);

const verificar = (elemento) => {
    let VoF = elemento.includes(2);
    console.log(VoF)
}

console.log(set);

set.forEach(verificar);
