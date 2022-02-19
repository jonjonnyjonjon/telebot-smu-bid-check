require("dotenv").config();
const { Telegraf, Scenes, Markup, session } = require("telegraf");

const axios = require("axios");
const QuickChart = require("quickchart-js");
const { v4: uuid4 } = require("uuid")

const fs = require("fs");
const path = require("path");

const { enter } = Scenes.Stage;

function formatUserInput(userInput) {
    let formattedUserInput = userInput.split(", ");
    let bwSplit = formattedUserInput[2].split("R").join("").split("W");
    formattedUserInput[2] = `Round ${bwSplit[0]} Window ${bwSplit[1]}`;
    return formattedUserInput
}

// User chose Bids In Text
const bidsInText = new Scenes.BaseScene("bidsInText");

bidsInText.enter(ctx => {
    ctx.replyWithHTML("To check for bids, please send me: term, course code and bidding window.\n\nExample: <b>2021-22 Term 2, IS215, R1BW1</b>\n\nI will reply with a list of instructors for you to choose from!")
})

bidsInText.action("again", enter("bidsInText"));
bidsInText.action("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});
bidsInText.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});

bidsInText.hears(/^\/[0-9]+/, async (ctx) => {
    let instructorIdx = parseInt(ctx.update.message.text.substring(1)) - 1;
    if (ctx.scene.session.instructorArr == null || typeof ctx.scene.session.instructorArr[instructorIdx] === 'undefined') {
        ctx.replyWithHTML("Did you send a wrong input? Please try again!")
    } else {
        let userInput = ctx.scene.session.currInput + ", " + ctx.scene.session.instructorArr[instructorIdx];
        let [term, courseCode, biddingWindow, instructor] = formatUserInput(userInput)
        try {
            const results = await axios.get("http://localhost:5000/api/bidding", {
                params: {
                    term: term,
                    courseCode: courseCode,
                    biddingWindow: biddingWindow,
                    instructor: instructor
                }
            });
            let msgReply = "Results for your query: \n\n";
            if (results.data.length !== 0) {
                for (let result of results.data) {
                    msgReply += `<u>Section ${result.section}</u>\nClass Size: ${result.enrolledStudents} out of ${result.vacancy}\nOpening vacancy: ${result.openingVacancy}\nBefore Vacancy: ${result.beforeProcessVacancy}\nAfter Vacancy: ${result.afterProcessVacancy}\nMedian Bid: ${result.medianBid}\nMin Bid: ${result.minBid}`;

                    msgReply += "\n\n";
                }
            } else {
                msgReply += "No results found.";
            }
            ctx.replyWithHTML(msgReply,
                Markup.inlineKeyboard([
                    [ Markup.button.callback("Search again", "again") ],
                    [ Markup.button.callback("Leave", "leave") ]
                ])
            );
        } catch (error) {
            ctx.reply(`An error has occured. Error message: ${error}. Please contact our admin with this issue, or you may proceed to search again or leave the bot.`,
                Markup.inlineKeyboard([
                    [ Markup.button.callback("Search again", "again") ],
                    [ Markup.button.callback("Leave", "leave") ]
            ]));
    }
    }
});

bidsInText.on("text", async (ctx) => {
    let [term, courseCode, biddingWindow] = formatUserInput(ctx.update.message.text)
    ctx.scene.session.currInput = ctx.update.message.text;
    try {
        const results = await axios.get("http://localhost:5000/api/instructors", {
            params: {
                term: term,
                courseCode: courseCode,
                biddingWindow: biddingWindow
            }
        });
        let msgReply = "Now, choose an instructor: \n\n";
        if (results.data.length !== 0) {
            ctx.scene.session.instructorArr = [];
            for (let i = 0; i < results.data.length; i++) {
                msgReply += `/${i + 1} ${results.data[i]}\n`
                ctx.scene.session.instructorArr.push(results.data[i])
            }
        } else {
            msgReply += "No results found, please try again!";
        }
        ctx.replyWithHTML(msgReply);
    } catch (error) {
        ctx.reply(`An error has occured. Error message: ${error}. Please contact our admin with this issue, or you may proceed to search again or leave the bot.`,
        Markup.inlineKeyboard([
            [ Markup.button.callback("Search again", "again") ],
            [ Markup.button.callback("Leave", "leave") ]
        ]));
    }
});

// User chose Bids In Graph
const bidsInGraph = new Scenes.BaseScene("bidsInGraph");

bidsInGraph.enter(ctx => {
    ctx.replyWithHTML("To generate a graph with bids, please either of the following to continue:\nOption 1: View past bids by their term, course code, instructor and section\nOption 2: View all past bids by term and course code",
    Markup.inlineKeyboard([
        [ Markup.button.callback("Option 1", "option1") ],
        [ Markup.button.callback("Option 2", "option2") ]
    ]));
});
bidsInGraph.action("option1", enter("bidsInGraphOption1"));
bidsInGraph.action("option2", enter("bidsInGraphOption2"));
bidsInGraph.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});

// User choose bidsInGraph - Option 1
const bidsInGraphOption1 = new Scenes.BaseScene("bidsInGraphOption1");
bidsInGraphOption1.enter(ctx => {
    ctx.replyWithHTML("Please send me the term, course code, instructor and section to generate the graph.\nExample: 2021-22 Term 2, IS215, Christopher Michael Poskitt, G7");
})
bidsInGraphOption1.action("again", enter("bidsInGraphOption1"));
bidsInGraphOption1.action("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
})
bidsInGraphOption1.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
})

bidsInGraphOption1.on("text", async (ctx) => {
    try {
        const userInput = ctx.update.message.text;
        let [term, courseCode, instructor, section] = userInput.split(", ");
        const results = await axios.get("http://localhost:5000/api/graphOption1", {
            params: {
                term: term,
                courseCode: courseCode.toUpperCase(),
                instructor: instructor.toUpperCase(),
                section: section.toUpperCase()
            }
        });

        if (results.data.length === 0) {
            ctx.reply("There is either no such course or no bids history for this course. Please try again or leave the bot to restart."),
            Markup.inlineKeyboard([
                [ Markup.button.callback("Search again", "again")] ,
                [ Markup.button.callback("Leave", "leave")] 
            ]);
            return;
        }

        let biddingWindows = [];
        let minBids = [];
        let medianBids = [];
        for (let result of results.data) {
            biddingWindows.push(result.biddingWindow);
            minBids.push(result.minBid);
            medianBids.push(results.medianBid);
        }
        biddingWindows = biddingWindows.reverse();
        minBids = minBids.reverse();
        medianBids = medianBids.reverse();

        const myChart = new QuickChart();
        myChart
        .setConfig({
            type: "bar",
            data: {
                labels: biddingWindows,
                datasets: [
                    {
                        type: "bar",
                        label: "Min bids",
                        backgroundColor: "rgba(255, 99, 132, 0.5)",
                        borderColor: "rgb(255, 99, 132)",
                        data: minBids
                    },
                    {
                        type: "line",
                        label: "Median bids",
                        backgroundColor: "rgba(75, 192, 192, 0.5)",
                        borderColor: "rgb(75, 192, 192)",
                        fill: false,
                        data: minBids
                    }
                ]
            },
            options: {
                title: {
                    display: true,
                    text: userInput
                },
                scales: {
                    xAxes: [
                        {
                            ticks: {
                                fontSize: 10
                            },
                            scaleLabel: {
                                display: true,
                                labelString: "Bidding round",
                            }
                        }
                    ],
                    yAxes: [
                        {
                            scaleLabel: {
                                display: true,
                                labelString: "e$",
                            }
                        }
                    ]
                },
                plugins: {
                    datalabels: {
                        display: true,
                        align: 'bottom',
                        backgroundColor: function(context) {
                            return context.dataset.backgroundColor;
                        },
                        color: 'white',
                        borderRadius: 3,
                        font: {
                            size: 18,
                        }
                    },
                }
            }
        })
        .setHeight(600)
        .setWidth(1000);

        const photoUUID = uuid4();
        await myChart.toFile(path.join(__dirname, `${photoUUID}.png`));

        ctx.replyWithPhoto(
            { source: path.join(__dirname, `${photoUUID}.png`) },
            { 
                caption: "This is your graph.",
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [ Markup.button.callback("Search again", "again") ],
                    [ Markup.button.callback("Leave", "leave") ]
                ])
            }
        );

        fs.unlink(path.join(__dirname, `${photoUUID}.png`), err => {
            if (err) console.log(err)
            else {
                console.log("Deleted file: " + path.join(__dirname, `${photoUUID}.png`))
            }
        });
    } catch (error) {
        if (error instanceof TypeError) {
            ctx.reply("Please check that your query follows the format in the example.");
        } else {
            ctx.reply(`An error has occured. Error message: ${error}. Please contact our admin with this issue, or you may proceed to search again or leave the bot.`,
                Markup.inlineKeyboard([
                    [ Markup.button.callback("Search again", "again") ],
                    [ Markup.button.callback("Leave", "leave") ]
            ]));
        }
    }
})

// User choose bidsInGraph - Option 2
const bidsInGraphOption2 = new Scenes.BaseScene("bidsInGraphOption2");

bidsInGraphOption2.action("again", enter("bidsInGraphOption2"));
bidsInGraphOption2.action("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});
bidsInGraphOption2.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});

bidsInGraphOption2.enter(ctx => {
    ctx.replyWithHTML("Please send me the term, course code, type of bid to generate the graph.\nExample: 2021-22 Term 2, IS215, median/min");
});
bidsInGraphOption2.on("text", async (ctx) => {
    try {
        const userInput = ctx.update.message.text;
        let [term, courseCode, metric] = userInput.split(", ");
        const results = await axios.get("http://localhost:5000/api/graphOption2", {
            params: {
                term: term,
                courseCode: courseCode.toUpperCase()
            }
        });

        if (results.data.length === 0) {
            ctx.reply("There is either no such course or no bids history for this course. Please try again or leave the bot to restart."),
            Markup.inlineKeyboard([
                [ Markup.button.callback("Search again", "again")] ,
                [ Markup.button.callback("Leave", "leave")] 
            ]);
            return;
        }

        let sortedResults = {};
        for (let result of results.data) {
            if (result.instructor in sortedResults) {
                if (result.section in sortedResults[result.instructor]) {
                    sortedResults[result.instructor][result.section]["biddingWindows"].push(result.biddingWindow);
                    sortedResults[result.instructor][result.section]["minBids"].push(result.minBid);
                    sortedResults[result.instructor][result.section]["medianBids"].push(result.medianBid);
                } else {
                    sortedResults[result.instructor][result.section] = {
                        biddingWindows: [result.biddingWindow],
                        minBids: [result.minBid],
                        medianBids: [result.medianBid]
                    };
                }
            } else {
                sortedResults[result.instructor] = {};
                sortedResults[result.instructor][result.section] = {
                    biddingWindows: [result.biddingWindow],
                    minBids: [result.minBid],
                    medianBids: [result.medianBid]
                };
            }
        }

        let dataConfigs = [];
        let biddingWindows;
        for (let instructor in sortedResults) {
            for (let section in sortedResults[instructor]) {
                let sectionInfo = sortedResults[instructor][section];
                if (!biddingWindows) {
                    biddingWindows = sectionInfo.biddingWindows.reverse();
                }

                let dataset = {
                    type: "line",
                    label: `${section}(${instructor})`,
                    fill: false,
                    borderColor: "#" + Math.floor(Math.random()*16777215).toString(16),
                    data: metric == "median" ? sectionInfo.medianBids.reverse() : sectionInfo.minBids.reverse()
                };
                dataConfigs.push(dataset);
            }
        }

        const myChart = new QuickChart();
        myChart
        .setConfig({
            type: "line",
            data: {
                labels: biddingWindows,
                datasets: dataConfigs
            },
            options: {
                title: {
                    display: true,
                    text: userInput
                },
                scales: {
                    xAxes: [
                        {
                            ticks: {
                                fontSize: 10
                            },
                            scaleLabel: {
                                display: true,
                                labelString: "Bidding round",
                            }
                        }
                    ],
                    yAxes: [
                        {
                            scaleLabel: {
                                display: true,
                                labelString: "e$",
                            }
                        }
                    ]
                }
            }
        })
        .setHeight(600)
        .setWidth(1000);

        const photoUUID = uuid4();
        await myChart.toFile(path.join(__dirname, `${photoUUID}.png`));

        ctx.replyWithPhoto(
            { source: path.join(__dirname, `${photoUUID}.png`) },
            { 
                caption: "This is your graph.",
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [ Markup.button.callback("Search again", "again") ],
                    [ Markup.button.callback("Leave", "leave") ]
                ])
            }
        );

        fs.unlink(path.join(__dirname, `${photoUUID}.png`), err => {
            if (err) console.log(err)
            else {
                console.log("Deleted file: " + path.join(__dirname, `${photoUUID}.png`))
            }
        });
    } catch (error) {
        if (error instanceof TypeError) {
            ctx.reply("Please check that your query follows the format in the example.");
        } else {
            ctx.reply(`An error has occured. Error message: ${error}. Please contact our admin with this issue, or you may proceed to search again or leave the bot.`,
                Markup.inlineKeyboard([
                    [ Markup.button.callback("Search again", "again") ],
                    [ Markup.button.callback("Leave", "leave") ]
            ]));
        }
    }
});

const bot = new Telegraf(process.env.BOT_TOKEN)

// Staging the scenes
const stage = new Scenes.Stage([bidsInText, bidsInGraph, bidsInGraphOption1, bidsInGraphOption2])
bot.use(session())
bot.use(stage.middleware())

bot.start(ctx => {
    ctx.replyWithHTML("Welcome to SMU Bid Checker bot. What do you want to do today?", Markup.inlineKeyboard([
        [ Markup.button.callback("View bids in Text format", "bidsInText") ],
        [ Markup.button.callback("View Bids in Graph format", "bidsInGraph") ]
    ]))
});
bot.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.leaveChat();
})
bot.action("bidsInText", ctx => ctx.scene.enter("bidsInText"));
bot.action("bidsInGraph", ctx => ctx.scene.enter("bidsInGraph"));

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))