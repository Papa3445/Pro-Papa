// PP-0011: bounded, read-only numeric analysis of requester-supplied data.
// No filesystem, network or account access. The input array is not echoed, but
// summary statistics (especially small samples) can reveal individual values.
// This is NOT a privacy-preserving aggregation: use nonsensitive inputs only.
const fail=()=>{throw Error('Invalid bounded data-profile inputs');};
export function profileNumericData(input) {
  try {
    if(input===null||typeof input!=='object'||Array.isArray(input)||
       ![Object.prototype,null].includes(Object.getPrototypeOf(input)))fail();
    const fields=Object.getOwnPropertyDescriptors(input);
    if(Reflect.ownKeys(fields).length!==1||!Object.hasOwn(fields,'values')||
       !Object.hasOwn(fields.values,'value')||!fields.values.enumerable)fail();
    const values=fields.values.value;
    if(!Array.isArray(values)||Object.getPrototypeOf(values)!==Array.prototype||
       values.length<1||values.length>100)fail();
    const elements=Object.getOwnPropertyDescriptors(values);
    if(Reflect.ownKeys(elements).length!==values.length+1||
       !Object.hasOwn(elements,'length'))fail();
    const numeric=[];
    let missing=0;
    for(let i=0;i<values.length;i++){
      const item=elements[String(i)];
      if(!item||!item.enumerable||!Object.hasOwn(item,'value'))fail();
      const x=item.value;
      if(x===null){missing++;continue;}
      if(typeof x!=='number'||!Number.isFinite(x)||Object.is(x,-0)||
         Math.abs(x)>1_000_000_000)fail();
      numeric.push(x);
    }
    if(numeric.length===0)fail();
    const sorted=numeric.toSorted((a,b)=>a-b);
    const sum=numeric.reduce((total,x)=>total+x,0);
    const count=numeric.length;
    const mean=sum/count;
    const median=count%2?sorted[(count-1)/2]:(sorted[count/2-1]+sorted[count/2])/2;
    if(![sum,mean,median].every(Number.isFinite))fail();
    return {numericCount:count,missingCount:missing,sum,mean,median,
      min:sorted[0],max:sorted[count-1],
      limitations:'Not privacy-preserving: summaries can reveal individual values, especially for small samples. Use nonsensitive data only. Caller-supplied values; nulls omitted; no source verification, statistical inference or external writes'};
  }catch{fail();}
}
