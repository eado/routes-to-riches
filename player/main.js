import blessed from "blessed";
import { readFileSync } from "fs";
import WebSocket from "ws";

import { calcNewRevenue, getRandomData } from './utils.js';

const TITLETEXT = readFileSync("title.txt").toString()

let screen;
let revenue = 0;
let wss;

const createScreen = () => {
    screen = blessed.screen({smartCSR: true});
    screen.key(["C-c"], () => {
        return process.exit(0);
    });
    return screen;
};

const createBox = (parent, width, height, top, left, content, color="blue") => {
    return blessed.box({
        parent,
        top,
        left,
        width,
        height,
        content,
        tags: true,
        border: {
            type: "line",
        },
        style: {
            fg: "white",
            bg: color,
            border: {
                fg: "white",
            },
        },
        align: "center",
        valign: "middle",
    });
};

// Screens
const startScreen = () => {
    const screen = createScreen();
    createBox(screen, "50%", "50%", "25%", "25%", TITLETEXT);
    screen.render();

    screen.key(['enter'], () => { 
        screen.destroy();
        initWaitScreen()
    });
};

const initWaitScreen = () => {
    wss = new WebSocket("ws://10.0.0.2:8081");
    wss.on("message", async (data) => {
        screen.destroy()
        if (data == "start") {
            mainScreen()
        } else {
            waitScreen()
        }
    });
    const screen = createScreen();
    createBox(screen, "33%", "33%", "33%", "33%", "Please hold until the simulation starts.");
    screen.render();
};

const waitScreen = () => {
    const screen = createScreen();
    let boxText = "";
    if (revenue == 0) {
        boxText = "Did you even try?\nYou made $0K in revenue. Do better next time."
    } else if (revenue < 20) {
        boxText =`That was certainly an attempt.\nYou made $${revenue}K in revenue.`
    } else if (revenue < 40) {
        boxText =`Pretty good.\nYou made $${revenue}K in revenue.`
    } else {
        boxText =`You're a pro!\nYou made $${revenue}K in revenue.`
    }
    createBox(screen, "33%", "33%", "33%", "33%", boxText);
    screen.render();
};

const mainScreen = () => {
    // Initial setup
    const screen = createScreen();

    revenue = 0;
    const routers = [];
    const used = [];
    const [locs, _, customers, as, routes, linkCosts] = getRandomData(10, 4);
    for (let loc of locs) {
        const box = createBox(screen, "10%", "20%", `${loc[0]}%`, `${loc[1]}%`, `${loc[2]}\n\nAS ${loc[3]}`, "clear");
        routers.push(box);
    }

    createBox(screen, "10%", 5, 0, 0, `COMCAST: AS ${as}`, "red");
    const revenueBox = createBox(screen, "10%", 5, 0, "10%", `Revenue: $${revenue}K`, "green");
    createBox(screen, "25%", 5, 0, "20%", `Customers: ${customers.map(x => "AS " + x).join(", ")}`, "clear");
    const routeBox = createBox(screen, "40%", 5, 0, "45%", `Route: ${customers.map(x => "AS " + x).join(", ")}`, "clear");
    const linkCostBox = createBox(screen, "15%", 5, 0, "85%", `Link Cost`, "blue");
    routeBox.style.border.fg = "green";

    // Update revenue
    const updateRevenue = () => {
        revenueBox.content = `Revenue: $${revenue}K`;
        screen.render()
    }

    // Focused router mechanism
    let currentRouter = 0;
    const focusRouter = (num) => { 
        routers.forEach(x => x.style.border.fg = "white")
        routers[num].style.border.fg = "green"; 
        currentRouter = num; 
        routeBox.content = `Route: ${routes[num][0].map(x => "AS " + x).join(" ")}, ${routes[num][1]}`
        screen.render() 
    }
    focusRouter(0);

    // Select router mechanism
    let currentlySelecting = false;
    let currentSelect = 0;
    let selected = [];
    const focusSelect = (num) => { 
        if (num == currentRouter) return;
        routers.forEach(x => x !== routers[currentRouter] ? x.style.border.fg = "white" : null)
        routers[num].style.border.fg = "blue"; 
        
        linkCostBox.content = `Link Cost: ${linkCosts[[locs[currentRouter][3], locs[num][3]]]}`
        currentSelect = num; 
        screen.render() 
    }

    const cleanUpSelect = () => {
        routers[currentRouter].style.bg = used.indexOf(currentRouter) > -1 ? "red" : "clear";
        if (currentRouter !== currentSelect) routers[currentSelect].style.border.fg = "clear";
        for (let select of selected) {
            routers[select].style.bg = used.indexOf(select) > -1 ? "red" : "clear";
        }
        linkCostBox.content = "Link Cost"
        selected = [];
        currentSelect = currentRouter;
        currentlySelecting = !currentlySelecting;
        screen.render()
    }
    screen.key(['enter'], () => {
        if (!currentlySelecting) {
            routers[currentRouter].style.bg = used.indexOf(currentRouter) > -1 ? "red" : "green";
            currentSelect = currentRouter;
            currentlySelecting = !currentlySelecting;
            screen.render()
        } else {
            if (selected.length > 0) {
                revenue += calcNewRevenue(as, locs[currentRouter][3], selected.map(x => locs[x][3]), customers, routes[currentRouter][0], linkCosts)
                updateRevenue();
                wss.send(+revenue);
            } 
            used.push(currentRouter);
            routers[currentRouter].style.bg = "red";
            if (used.length == routers.length) {
                screen.destroy()
                waitScreen()
            }
            cleanUpSelect();
            for (let i = 0; i < locs.length; i++) {
                if (used.indexOf(i) < 0) focusRouter(i);
            }
        }
         
    });
    screen.key(['escape'], cleanUpSelect)

    screen.key(['space'], () => {
        if (!currentlySelecting || currentSelect === currentRouter) return;
        if (selected.indexOf(currentSelect) > -1) {
            selected = selected.filter(x => x != currentSelect);
            routers[currentRouter].style.bg = used.indexOf(currentRouter) > -1 ? "red" : "clear";
        } else {
            selected.push(currentSelect)
            routers[currentSelect].style.bg = "blue";
        }
        screen.render()
    })


    // Arrow key play
    const changeFocus = (dim, pos) => {
        let moveTo = currentlySelecting ? currentSelect : currentRouter;
        let greatDiff = pos ? 100: -100;
        for (let i = 0; i < locs.length; i++) {
            if (i === currentRouter || (currentlySelecting && i === currentSelect) || (!currentlySelecting && used.indexOf(i) > -1)) continue;
            const diff = locs[currentlySelecting ? currentSelect : currentRouter][dim] - locs[i][dim]
            if ((pos && diff > 0 && diff < greatDiff) || (!pos && diff < 0 && diff > greatDiff)) {
                moveTo = i;
                greatDiff = diff;
            }
        }
        currentlySelecting ? focusSelect(moveTo) : focusRouter(moveTo);
    }
    screen.key(['up'], () => { changeFocus(0, 1) });
    screen.key(['down'], () => { changeFocus(0, 0) });
    screen.key(['left'], () => { changeFocus(1, 1) });
    screen.key(['right'], () => { changeFocus(1, 0) });

    screen.render()
}

startScreen()