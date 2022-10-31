export function splitIntoChunk(arr:any[], chunk:number) {
    let tempArray = []
    for (let i=0; i < arr.length; i += chunk) {
        tempArray.push(arr.slice(i, i + chunk))
    }
    return tempArray

}