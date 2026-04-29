const fs = require('fs');

let trips = fs.readFileSync('src/data/trips.ts', 'utf8');

// The broken syntax looks like:
//    driverId: 'u8',
//  ,
// or
//    condition: 'CLEAN',
//  ,

// Let's replace the standalone `  ,` with `    branchId: 'YWG',\n  },`
trips = trips.replace(/\n  ,/g, "\n    branchId: 'YWG',\n  },");

// Let's also check if any branchId is duplicated again, just to be safe
trips = trips.replace(/branchId: 'YWG',\s+branchId: 'YWG',/g, "branchId: 'YWG',");

fs.writeFileSync('src/data/trips.ts', trips);
console.log('Fixed trips.ts syntax');
