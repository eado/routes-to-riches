const getRandomCoordinate = (existingCoords) => {
    let coord1, coord2;
    let valid = false;

    let it = 0;
    while (!valid && it < 10) {
        coord1 = Math.floor(Math.random() * 70) + 10;
        coord2 = Math.floor(Math.random() * 85) + 5;
        valid = existingCoords.every(
            ([x, y]) => ((Math.abs(x - coord1) >= 20 || Math.abs(y - coord2) >= 20) && y != coord2 && x != coord1)
        );
        it++;
    }

    return it >= 10 ? null : [coord1, coord2];
}

const getRandomPrefix = () => {
    const octet1 = Math.floor(Math.random() * 99 + 1);
    const octet2 = Math.floor(Math.random() * 99 + 1);
    const octet3 = Math.floor(Math.random() * 254 + 1);
    return `${octet1}.${octet2}.${octet3}.0/24`;
}

const getRoute = (as, curAs, customers, peers) => {
    const prefix = getRandomPrefix()
    const len = Math.floor(Math.random() * 3 + 1);
    const rand = [];

    for (let i = 0; i < 8; i++) {
        const t = Math.floor(Math.random() * 99 + 1);
        if (t == as || t == curAs || peers.indexOf(t) > -1 || rand.indexOf(t) > -1) {
            i--;
            continue;
        }
        rand.push(t);
    }

    const path = [];
    for (let i = 0; i < len; i++) {
        if (i == 0) {
            const isCust = Math.random() > 0.5
            if (isCust) {
                path.push(customers[Math.floor(Math.random() * customers.length)])
            } else {
                const comb = [curAs, ...rand, ...peers]
                path.push(comb[Math.floor(Math.random() * comb.length)])
            }
            
        } else {
            const comb = [curAs, ...rand, ...peers]
            path.push(comb[Math.floor(Math.random() * comb.length)])
        }

        if (path[i] == as || (i > 0 && path[i - 1] == path[i])) {
            i--;
            path.pop()
        }
    }
    path.push(as)
    return [path.reverse(), prefix];
}

const getRandomPeer = (existingPeers) => {
    let valid = false;
    let rand;

    while (!valid) {
        rand = Math.floor(Math.random() * 99 + 1)
        valid = existingPeers.indexOf(rand) < 0
    }

    return rand;
}

export const getRandomData = (num, numCust) => {
    let locs = [];
    let coords = [];
    let peers = [];
    let routes = [];
    let linkCosts = {};
    for (let i = 0; i < num; i++) {
        const coord = getRandomCoordinate(coords);

        if (!coord) {
            locs = [];
            coords = [];
            peers = [];
            routes = [];
            i = -1;
            continue;
        }

        const peer = getRandomPeer(peers);
        coords.push(coord);
        peers.push(peer);
        const octet3 = Math.floor(Math.random() * 254 + 1);
        const octet4 = Math.floor(Math.random() * 99 + 1);
        const ip = `3.33.${octet3}.${octet4}`;
        locs.push([...coord, ip, peer]);
    }

    const bucket = [...peers];
    const customers = [];
    for (let i = 0; i < numCust; i++) {
        const idx = Math.floor(Math.random() * bucket.length);
        customers.push(bucket.splice(idx, 1)[0]);
    }

    const curAs = getRandomPeer(peers)
    for (let i = 0; i < num; i++) {
        routes.push(getRoute(peers[i], curAs, customers, peers))
    }

    for (let i = 0; i < num; i++) {
        for (let j = 0; j < num; j++) {
            if ([j, i] in linkCosts) {
                linkCosts[[locs[i][3], locs[j][3]]] = linkCosts[[locs[j][3], locs[i][3]]]
            } else {
                linkCosts[[locs[i][3], locs[j][3]]] = Math.floor(Math.random() * 19) + 1
            }
        }
    }

    return [locs, peers, customers, curAs, routes, linkCosts];
}

export const calcNewRevenue = (curAS, fromAS, toASes, customers, path, linkCosts) => {
    // Check for duplicates
    if (path.indexOf(curAS) > -1) process.exit()
    const s = new Set(path)
    if (s.size < path.length) process.exit()

    let newRev = 0;
    const fromCust = customers.indexOf(fromAS) > -1
    for (let as of toASes) {
        if (path.indexOf(as) > -1) process.exit()
        if (customers.indexOf(as) > -1) { newRev += 10; } 
        if (fromCust) { newRev += 10; } 
        if (!fromCust && customers.indexOf(as) < 0) {
            newRev -= 1;
        }
        newRev -= linkCosts[[fromAS, as]]
    }
    return newRev;
}