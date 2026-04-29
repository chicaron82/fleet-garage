const fs = require('fs');

let trips = fs.readFileSync('src/data/trips.ts', 'utf8');

// Remove all branchId fields entirely
trips = trips.replace(/(\s+)branchId:\s*'(.*?)',/g, '');

// Re-add them right before the closing bracket of the object
trips = trips.replace(/(\s+)}/g, (match, p1) => {
  // We only want to add it to objects that have `driverId:` or `tripType:` 
  // Let's do it by finding `driverId:` up above. Actually easier to just regex the block.
  return `${match}`; 
});

// Since the above is tricky, I'll just use a smarter replace on the TripRun objects.
// Let's re-read the clean version (without branchId)
let cleanTrips = fs.readFileSync('src/data/trips.ts', 'utf8');
cleanTrips = cleanTrips.replace(/(\s+)branchId:\s*'(.*?)',/g, '');

// Every trip run object starts with `{ id: 'tr-'` and ends with `},`
// We will insert `branchId: 'YWG'` right before the closing `}` if it doesn't have it.
cleanTrips = cleanTrips.replace(/(driverId: '.*?'.*?)(\n\s+)}/gs, "$1$2");

const tripBlocks = cleanTrips.split('{\n    id: \'tr-');
if (tripBlocks.length > 1) {
    let newContent = tripBlocks[0];
    for (let i = 1; i < tripBlocks.length; i++) {
        let block = tripBlocks[i];
        // The block is everything up to the next `{ id:` or end of array.
        // The end of the object is `  },`
        block = block.replace(/\n  },/, ",\n    branchId: 'YWG'\n  },");
        newContent += '{\n    id: \'tr-' + block;
    }
    cleanTrips = newContent;
}

fs.writeFileSync('src/data/trips.ts', cleanTrips);
console.log('Fixed trips.ts');
