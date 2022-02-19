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
    ctx.replyWithHTML("To check for past bidding results in text format, please send me your request in the following format: term, course code and bidding window.\n\nExample: <b>2021-22 Term 2, IS215, R1BW1</b> (P.S. The comma is important!)\n\nI will reply with a list of instructors for you to choose from!")
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
                    [Markup.button.callback("Search again", "again")],
                    [Markup.button.callback("Leave", "leave")]
                ])
            );
        } catch (error) {
            ctx.reply(`An error has occured. Error message: ${error}. Please contact our admin with this issue, or you may proceed to search again or leave the bot.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback("Search again", "again")],
                    [Markup.button.callback("Leave", "leave")]
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
        let msgReply = "Please choose an instructor by clicking on the number or typing it out (e.g. /1) \n\n";
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
                [Markup.button.callback("Search again", "again")],
                [Markup.button.callback("Leave", "leave")]
            ]));
    }
});

// User chose Bids In Graph
const bidsInGraph = new Scenes.BaseScene("bidsInGraph");

bidsInGraph.enter(ctx => {
    ctx.replyWithHTML("To generate a graph with the past bid results, please choose one of the options to continue:\n\nOption 1: View past bid results by their term, course code, instructor and section\nOption 2: View all past bid results by term and course code (shows all sections)",
        Markup.inlineKeyboard([
            [Markup.button.callback("Option 1", "option1")],
            [Markup.button.callback("Option 2", "option2")]
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
    ctx.replyWithHTML("Please send me your request in the following format: term, course code, instructor and section\n\nExample: <b>2021-22 Term 2, IS215, Christopher Michael Poskitt, G7</b> (P.S. The comma is important!)");
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
                    [Markup.button.callback("Search again", "again")],
                    [Markup.button.callback("Leave", "leave")]
                ]);
            return;
        }

        let biddingWindows = [];
        let minBids = [];
        let medianBids = [];
        for (let result of results.data) {
            biddingWindows.push(result.biddingWindow);
            minBids.push(result.minBid);
            medianBids.push(result.medianBid);
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
                            data: medianBids
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
                            backgroundColor: function (context) {
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
                caption: "Here is your graph!",
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("Search again", "again")],
                    [Markup.button.callback("Leave", "leave")]
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
                    [Markup.button.callback("Search again", "again")],
                    [Markup.button.callback("Leave", "leave")]
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
    ctx.replyWithHTML("Please send me your request in the following format: term, course code, bid type ('median' or 'min')\n\nExample: <b>2021-22 Term 2, IS215, median</b> (P.S. The comma is important!)");
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
                    [Markup.button.callback("Search again", "again")],
                    [Markup.button.callback("Leave", "leave")]
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
                    borderColor: "#" + Math.floor(Math.random() * 16777215).toString(16),
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
                caption: "Here is your graph!",
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("Search again", "again")],
                    [Markup.button.callback("Leave", "leave")]
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
                    [Markup.button.callback("Search again", "again")],
                    [Markup.button.callback("Leave", "leave")]
                ]));
        }
    }
});

// User chooses Search for Course Code
const searchCourseCode = new Scenes.BaseScene("searchCourseCode");

searchCourseCode.enter(ctx => {
    ctx.replyWithHTML("To look for a course code, please send me the name of the course that you are looking for.\n\nFor example, '<b>intro to programming</b>'.")
})

searchCourseCode.action("again", enter("searchCourseCode"));
searchCourseCode.action("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});
searchCourseCode.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.scene.leave();
});

searchCourseCode.on("text", async (ctx) => {
    let userInput = ctx.update.message.text;
    try {
        const results = await axios.get("http://localhost:5000/api/courseCode", {
            params: {
                description: userInput
            }
        });
        let msgReply = ["Here are the course codes that correspond to the course name that you have provided!\n\n"];
        if (results.data.length !== 0) {
            for (let i = 0; i < results.data.length; i++) {
                let result = results.data[i];
                if ((msgReply[msgReply.length - 1].length + `<b>•</b> ${result.courseCode}: ${result.description}\n`.length) > 4096) {
                    msgReply.push("");
                }
                msgReply[msgReply.length - 1] += `<b>•</b> ${result.courseCode}: ${result.description}\n`;
            }
        } else {
            msgReply = "No results found, please try again!";
        }

        // replies with every element in the array except for the last one
        // if there is only one element in the array, there will be no
        // output from this for loop
        for (let i = 0; i < msgReply.length - 1; i++) {
            ctx.replyWithHTML(msgReply[i]);
        }

        // replies the user with the last element in the array along
        // with the button options
        setTimeout(() => {
            ctx.replyWithHTML(msgReply[msgReply.length - 1],
                Markup.inlineKeyboard([
                    [Markup.button.callback("Search again", "again")],
                    [Markup.button.callback("Leave", "leave")]
                ])
            );
        }, 500);

    } catch (error) {
        ctx.reply(`An error has occured. Error message: ${error}. Please contact our admin with this issue, or you may proceed to search again or leave the bot.`,
            Markup.inlineKeyboard([
                [Markup.button.callback("Search again", "again")],
                [Markup.button.callback("Leave", "leave")]
            ]));
    }
});

const bot = new Telegraf(process.env.BOT_TOKEN)

// Staging the scenes
const stage = new Scenes.Stage([bidsInText, bidsInGraph, bidsInGraphOption1, bidsInGraphOption2, searchCourseCode])
bot.use(session())
bot.use(stage.middleware())

bot.start(ctx => {
    ctx.replyWithHTML("Welcome to SMU BOSS Results bot!\n\nYou can look for the past bidding results here instead of having to log into BOSS!\n\nWhat do you want to search for?", Markup.inlineKeyboard([
        [Markup.button.callback("View Past Bid Results in Text Format", "bidsInText")],
        [Markup.button.callback("View Past Bid Results in Graph Format", "bidsInGraph")],
        [Markup.button.callback("Search for a Course Code", "searchCourseCode")]
    ]))
});
bot.command("leave", ctx => {
    ctx.reply("Bye bye! Thanks for using our bot.");
    ctx.leaveChat();
})
bot.action("bidsInText", ctx => ctx.scene.enter("bidsInText"));
bot.action("bidsInGraph", ctx => ctx.scene.enter("bidsInGraph"));
bot.action("searchCourseCode", ctx => ctx.scene.enter("searchCourseCode"));

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))