import blessed from 'blessed';
import { WebSocketServer } from "ws";
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const NUMQUESTIONS = 8;

const wss = new WebSocketServer({ host: '0.0.0.0', port: 8081 });
const server = express();

const players = {};

server.get('/', (_, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    res.sendFile(path.join(__dirname, '/index.html'));
});

server.get('/progress', (_, res) => {
    const progress = {}
    for (let player in players) {
        progress[player] = players[player].score
    }

    res.send(progress);
});

server.listen(8080);

let screen;
let titleBox;

/* STATES */
const START = 0;
const ANSWER = 1;
const WAIT = 2;

let currentState = START;

// Function to create the title screen
function createTitleScreen(
    title,
    text,
    buttonLabels,
    time = 0,
    istextBox = false,
    sure = false
) {
    return new Promise((res, _) => {
        let ans = "";
        // Create a screen object.
        screen = blessed.screen({
            smartCSR: true,
        });
        // Add a way to quit the program
        screen.key(["C-c"], (ch, key) => {
            return process.exit(0);
        });
        screen.title = title;

        titleBox = blessed.box({
            top: "center",
            left: "left",
            width: "49%",
            height: "100%",
            content: text,
            tags: true,
            border: {
                type: "line",
            },
            style: {
                fg: "white",
                bg: "blue",
                border: {
                    fg: "#f0f0f0",
                },
            },
            align: "center",
            valign: "middle",
        });

        // Button configurations
        const buttons = [];

        const areYouSure = () => {
            const sureBox = blessed.box({
                parent: screen,
                top: "center",
                left: "center",
                width: "25%",
                height: "25%",
                content:
                    "Is this your final answer? Press enter to submit and escape to go back.",
                tags: true,
                border: {
                    type: "line",
                },
                style: {
                    fg: "white",
                    bg: "blue",
                    border: {
                        fg: "#f0f0f0",
                    },
                },
                align: "center",
                valign: "middle",
            });

            screen.key("escape", () => {
                ans = "";
                sureBox.detach();
                screen.render();
            });
            sureBox.focus();
        };

        // Create buttons dynamically
        if (buttonLabels) buttonLabels.forEach((label, index) => {
            const button = blessed.button({
                parent: titleBox,
                top: index * 5,
                left: "100%",
                width: "100%",
                height: 5,
                content: label,
                align: "center",
                valign: "middle",
                tags: true,
                border: {
                    type: "line",
                },
                style: {
                    fg: "white",
                    focus: {
                        bg: "blue",
                    },
                },
            });

            // Handle button press
            button.on("press", () => {
                if (sure) {
                    ans = label;
                    areYouSure();
                } else {
                    screen.destroy();
                    res(label);
                }
            });

            buttons.push(button);
        });

        if (istextBox) {
            const textBox = blessed.textbox({
                parent: titleBox,
                top: buttons.length * 5,
                left: "100%",
                width: "100%",
                height: 5,
                label: "Enter your answer (press escape to exit text box): ",
                border: {
                    type: "line",
                },
                style: {
                    fg: "white",
                    focus: {
                        bg: "blue",
                    },
                },
                inputOnFocus: true,
            });

            buttons.push(textBox);

            textBox.on("submit", (text) => {
                if (sure) {
                    ans = text;
                    areYouSure();
                } else {
                    screen.destroy();
                    res(text);
                }
            });
        }

        if (time) {
            const timeToText = () => {
                const min =
                    Math.floor(time / 60) < 10
                        ? "0" + Math.floor(time / 60)
                        : +Math.floor(time / 60);
                const sec = time % 60 < 10 ? "0" + (time % 60) : +(time % 60);
                return min + ":" + sec;
            };

            const timerBox = blessed.box({
                parent: titleBox,
                top: "top",
                left: "left",
                width: 20,
                height: 5,
                content: timeToText(),
                tags: true,
                border: {
                    type: "line",
                },
                style: {
                    fg: "white",
                    border: {
                        fg: "#f0f0f0",
                    },
                },
                align: "center",
                valign: "middle",
            });

            const int = setInterval(() => {
                if (time == 0) {
                    clearInterval(int);
                    return;
                }
                time -= 1;
                timerBox.content = timeToText();
                if (time < 20 && time % 2 == 0) timerBox.style.bg = "red";
                else timerBox.style.bg = "";
                screen.render();
            }, 1000);
        }

        screen.append(titleBox);
        if (buttonLabels) buttons[0].focus(); // Focus the first button

        // Allow pressing 'Enter' to activate the button
        screen.key(["enter"], () => {
            if (ans) {
                screen.destroy();
                res(ans);
                return;
            }
            const focused = screen.focused;
            if (focused.submit) focused.submit()
            else focused.press();
        });

        // Allow using arrow keys to switch between buttons
        screen.key(["up", "down", "left", "right"], (ch, key) => {
            let focusedIndex = buttons.indexOf(screen.focused);
            if (key.name === "up" || key.name === "left") {
                focusedIndex =
                    (focusedIndex - 1 + buttons.length) % buttons.length;
            } else if (key.name === "down" || key.name === "right") {
                focusedIndex = (focusedIndex + 1) % buttons.length;
            }
            buttons[focusedIndex].focus();
            screen.render();
        });

        screen.render();
    });
}

wss.on("connection", function connection(ws, req) {
    const addr = req.socket.remoteAddress;
    if (Object.keys(players).indexOf(addr) < 0 && currentState == START) {
        titleBox.content += addr + "\n";
        screen.render()
    }
    screen.render()
    players[addr] = {
        socket: ws,
        score: 0,
        updateScore: 0
    };

    ws.on("message", function message(data) {
        if (currentState == ANSWER) {
            const score = Number(data.toString())
            players[addr].updateScore = score
            titleBox.content += addr + ": " + score + "\n";
            screen.render()
        }
    });

});



async function main() {
    await createTitleScreen('', 'Waiting for players...\n', ['Start Game'], 0, false, true);

    while (true) {
        currentState = ANSWER;

        wss.clients.forEach(ws => ws.send("start"));
        await createTitleScreen('', "Answered:\n", ['End Round'], 120, false, true);
        currentState = WAIT;
        wss.clients.forEach(ws => ws.send("end"));
        for (let player in players) {
            players[player].score += players[player].updateScore;
            players[player].updateScore = 0
        }
        await createTitleScreen('', "Start new round", ['Start Round'], 120, false, true);
    }
}

main()
