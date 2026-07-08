function d(e,c){const o="\uFEFF"+c.map(a=>a.map(r=>`"${String(r??"").replace(/"/g,'""')}"`).join(";")).join(`\r
`),n=new Blob([o],{type:"text/csv;charset=utf-8"}),t=document.createElement("a");t.href=URL.createObjectURL(n);const s=new Date().toISOString().slice(0,10);t.download=e.includes(".")?e:`${e}_${s}.csv`,t.click(),URL.revokeObjectURL(t.href)}export{d};
