//TODO - want a Settings button on UI to set up players, toggle switches, etc

//Add/remove player names here as needed
//More than 4 will appear as abbreviations only
//Will be automatically sorted in UI
var playerNames = [
    "Tim Johnson",
    "Rhonda Johnson",
    //"Kyle Szuta",
    "Jessie Johnson"
]
var players;

//Need to bake in whatever the rules are for determining pointsToWin - depends on extensions/expansions and
//number players I think.
var pointsToWin = 13;

//Set to false to show the dice-section for tracking stats on dice-rolls. Default is disabled.
var disableDice = true;

//Set to true to enable numPad section - not currently working. Idea was that on iPad doing the
//press-hold to subtract number from a cell is not reliable so wanted to show a numPad UI to let user
//directly increment/decrement a cell value and hit Save
var enableNumPad = false;

var rowIndexes = {
    settlements: 0,
    cities: 1,
    activeKnights: 2,
    metropolis: 3,
    victoryPoints: 4,
    merchant: 5,
    longestRoad: 6,
    totals: 7
};
var rowNames = ["Settlements", "Cities", "Knight Pts", "Metropolis", "Victory Pts", "Merchant", "Longest Road", "TOTAL" ];

//Track actual vs. expected counts/frequencies for dice rolls (color-die vs. number dice)
var diceNumFrequencies = [0,0,0,0,0,0,0,0,0,0,0]
var diceColorFrequencies = [0,0,0,0]
var expectedDiceNumFrequencies = [2.8, 5.6, 8.3, 11.1, 13.9, 16.7];
var expectedDiceColorFrequencies = [50.0, 16.7, 16.7, 16.7]

var clickTimer = null;
var curSelectedCell = null;
var curSelectedDie = null;
var decInProgress = false;  //Used only for context-menu special case to prevent double-firing

//TODO: support other objects used in expansions and extensions 

$(function () {
    //Create player objects with full names or abbreviations-only if > 4
    players = [];
    playerAbbrevs = [];
    $.each(playerNames.sort(), function (index, playerName) {
        var parts = playerName.split(" ");
        var firstName = parts[0];
        var lastNameLetter = parts.length == 1 ? "" : parts[1].substr(0,1);

        var abbrev = firstName.substr(0,1);
        if (playerAbbrevs.includes(abbrev)) {
            var both = abbrev+lastNameLetter;
            if (playerAbbrevs.includes(both)) {
                both = abbrev + (index+1).toString();
            }
            abbrev = both;
        }
        playerAbbrevs.push(abbrev);

        players.push({
            index: index + 1, 
            name: playerName,
            firstName: firstName, 
            abbrev: playerAbbrevs[index],
            settlementCount: 0,
            cityCount: 0,
            metropolisCount: 0,
            activeKnightCount: 0,
            victoryPoints: 0,
            hasMerchant: false,
            hasLongestRoad: false,
            totalPoints: 3
        })
    });

    //Event handler for number-dice clicks
    $(".rolls .diceNum").click(function(e) {
        curSelectedDie = $(this);

        //highlight selection
        $(".rolls .diceNum").removeClass("selected");
        $(curSelectedDie).addClass("selectedDown");
        setTimeout (function () {
            $(curSelectedDie).removeClass("selectedDown");
            $(curSelectedDie).addClass("selected");
        }, 300);

        //update frequency count
        index = parseInt($(this).text(), 10) - 2;
        diceNumFrequencies[index]++;
    });

    //Event handler for color-die clicks
    $(".rolls .diceColor").click(function(e) {
        curSelectedDie = $(this);

        //highlight selection
        $(".rolls .diceColor").removeClass("selected");
        setTimeout (function () {
            $(curSelectedDie).addClass("selected");
        }, 50);

        //update frequency count
        var id = $(this).attr("id");
        index = id == "dieBarb" ? 0 : id == "dieGreen" ? 1 : id == "dieYellow" ? 2 : 3;
        diceColorFrequencies[index]++;
    });

    setupEmptyBoard();

    newGame();
});

function setupEmptyBoard() {
    //Hide dice panel if requested
    if (disableDice) {
        $(".diceDiv").hide();
    }
        
    $(".board").append("<thead><tr><th></th></tr></thead><tbody></tbody>");
    
    //Create player-names row
    $.each(players, function (index, player) {
        var displayName = players.length > 4 ? player.abbrev : player.firstName;
        var row = $(".board thead tr");
        $(row).append($("<th></th>").text(displayName));
    });

    //Create remaining rows
    var rowCount = Object.keys(rowIndexes).length;
    for (var rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        $(".board tbody").append("<tr></tr>");
        var row = $(".board tbody tr:eq(" + rowIndex + ")");
        for (var i = 0; i < players.length + 1; i++) {
            $(row).append("<td></td>");
        }
        $(row).find("td:eq(0)").text(rowNames[rowIndex]);
    };
    $(".board tbody tr:last-child td:eq(0)").text("TOTAL");

    //Set custom attributes for rows with images
    var merchantRow = $(".board tbody tr:eq(" + rowIndexes.merchant + ")");
    var longestRoadRow = $(".board tbody tr:eq(" + rowIndexes.longestRoad + ")");

    $(merchantRow).css("height", "120px");
    $(merchantRow).find("td:not(:first-child)").append('<img width="90px">');
    $(longestRoadRow).css("height", "127px");
    $(longestRoadRow).find("td:not(:first-child)").append('<img width="70px">');

    //Adjust column widths based on number of players
    if (playerNames.length > 4) {
        $(".board td:first-child").css("width", "260px");
        $(".board td:not(:first-child)").css("width", "104px");
    }

    //Record start-time of touchstart to compare to touchend - click to inc, click-hold to dec
    $(".board td:not(:first-child)").on("touchstart", function() {
        curSelectedStartTime = new Date();
        curSelectedCell = $(this);

        if (enableNumPad)
            updatePlayerCell($(this), 1, true);   //Increment for quick-tap        
    });

    $(".board td:not(:first-child)").on("touchend", function() {
        if (!enableNumPad) {
            var elapsedTimeMs = (new Date()) - curSelectedStartTime;
            if (elapsedTimeMs <= 500)
                updatePlayerCell($(this), 1, true);   //Increment for quick-tap
            else {
                updatePlayerCell($(this), -1, true);  //Decrement for tap-hold
            }        
        };
    });

    //Treat right-click/contextMenu as click-hold event so do decrement
    $(".board td:not(:first-child)").bind("contextmenu",function(e){
        e.preventDefault();
        if (!decInProgress) {
            updatePlayerCell($(this), -1, true);  //Decrement for tap-hold
        }
        return false;
     });     
}

function newGame() {
    //Set images for merchant and longestRoad rows but hide until used
    for (var i = 5; i <= 6; i++) {
        curRow = $(".board tbody tr:eq(" + i + ")");
        $.each(players, function (index, player) {
            var playerCol = curRow.find("td:eq(" + player.index + ")");
            playerCol.find("img").attr("src", (i == 5 ? "merchant.png" : "road.png"));
            playerCol.find("img").hide();
        });
    }
    $(".numpad").hide();

    //Reset to initial counts for settlements/cities etc
    $.each(players, function (index, player) {
        player.settlementCount = 1;
        player.cityCount = 1;
        player.metropolisCount = 0;
        player.activeKnightCount = 0;
        player.victoryPoints = 0;
        player.hasMerchant = false;
        player.hasLongestRoad = false;
    });

    updateBoard();
}

//Show frequency-dialog when button clicked
function showFrequencies() {
    var totalDiceRolls = 0;
    $.each(diceNumFrequencies, function (index, dieFrequency) {
        totalDiceRolls+= dieFrequency;
    });
    $("#totalRolls").text(" - " + totalDiceRolls.toString() + " total rolls");

    for (var i = 0; i< diceNumFrequencies.length; i++) {
        var dieFrequency = diceNumFrequencies[i];
        var actualPct = totalDiceRolls == 0 ? 0 : Math.floor((dieFrequency / totalDiceRolls) * 100);
        var targetRow = i < 6 ? i : 4 - (i % 6);
        var targetCountCol = i < 6 ? 1 : 4;

        //Show actual count/pct
        var actualCountCell = $("#diceNumTable tbody tr:eq(" + targetRow + ") td:eq(" + targetCountCol + ")");
        var actualPctCell = $("#diceNumTable tbody tr:eq(" + targetRow + ") td:eq(" + (targetCountCol+1) + ")");
        $(actualCountCell).text(dieFrequency.toString());
        $(actualPctCell).text(actualPct.toString() + "%");

        //Show expected count/pct
        var expectedPct = expectedDiceNumFrequencies[targetRow];
        var expectedCnt = totalDiceRolls == 0 ? 0 : Math.ceil((expectedPct/100) * totalDiceRolls);

        if (i < 6) {
            $("#diceNumTable tbody tr:eq(" + targetRow + ") td:eq(6)").text(expectedCnt.toString());
            $("#diceNumTable tbody tr:eq(" + targetRow + ") td:eq(7)").text(expectedPct.toString() + "%");
        }

        //Highlight any with higher than expected percentage
        if (actualPct > expectedPct) {
            $(actualCountCell).addClass("higherThanExpectedPercentage");
            $(actualPctCell).addClass("higherThanExpectedPercentage");
        }
        else {
            $(actualCountCell).removeClass("higherThanExpectedPercentage");
            $(actualPctCell).removeClass("higherThanExpectedPercentage");
        }
    }
    
    for (var i = 0; i< diceColorFrequencies.length; i++) {
        dieFrequency = diceColorFrequencies[i];
        actualPct = totalDiceRolls == 0 ? 0 : Math.floor((dieFrequency / totalDiceRolls) * 100);

        //Show actual count/pct
        actualCountCell = $("#diceColorTable tbody tr:eq(" + i + ") td:eq(1)");
        actualPctCell = $("#diceColorTable tbody tr:eq(" + i + ") td:eq(2)");
        $(actualCountCell).text(dieFrequency.toString());
        $(actualPctCell).text(actualPct.toString() + "%");

        //Show expected count/pct
        var expectedPct = expectedDiceColorFrequencies[i];
        var expectedCnt = totalDiceRolls == 0 ? 0 : Math.ceil((expectedPct/100) * totalDiceRolls);

        $("#diceColorTable tbody tr:eq(" + i + ") td:eq(3)").text(expectedCnt.toString());
        $("#diceColorTable tbody tr:eq(" + i + ") td:eq(4)").text(expectedPct.toString() + "%");

        //Highlight any with higher than expected percentage
        if (actualPct > expectedPct) {
            $(actualCountCell).addClass("higherThanExpectedPercentage");
            $(actualPctCell).addClass("higherThanExpectedPercentage");
        }
        else {
            $(actualCountCell).removeClass("higherThanExpectedPercentage");        
            $(actualPctCell).removeClass("higherThanExpectedPercentage");        
        }
    }

    $(".frequencies").show();
}

function hideFrequencies() {
    $(".frequencies").hide();
}

//Show winner-dialog when Winner determined
function showWinner(playerName) {
    playSound("winner.mp3");
    $("#winner").text(playerName + "!!!");
    $(".winner").show();
    $(".diceDiv").hide();
    $(".board").hide();
    $("#mainButtons").hide();
}

function hideWinner() {
    $(".winner").hide();

    if (!disableDice) {
        $(".diceDiv").show();
    }
    $(".board").show();
    $("#mainButtons").show();
}

//Used when showing numPad
function bumpNumPadValue (increment) {
    var curValue = parseInt($(".numpad input").val(), 10);
    curValue += increment;
    $(".numpad input").val(curValue.toString());
    $(".numpad").hide();
    updatePlayerCell($(curSelectedCell), 1, false, curValue);
}

function keepNumPadValue(shouldKeep) {
    $(".numpad").hide();
    if (shouldKeep) {
        var newValue = parseInt($(".numpad input").val(), 10);
        updatePlayerCell($(curSelectedCell), 1, false, newValue);
    }
}

//Update the player-cell that was clicked, depending on which row/attribute it refers to
function updatePlayerCell (cell, increment, shouldShowNumPad, numPadValue) {
    decInProgress = true;
    var playerIndex = cell[0].cellIndex - 1;
    var targetPlayer = players[playerIndex];
    var newValue = 0;

    var rowIndex = cell.parent()[0].rowIndex - 1;

    if (rowIndex < 5 && enableNumPad && shouldShowNumPad) {
        //Load numpad text with current value
        var curValue = $(cell).text();
        $(".numpad input").val(curValue)
        $(".numpad").show();
        decInProgress = false;
        return;
    }

    switch (rowIndex) {
        case 0:
            //enableNumPad ? newValue : targetPlayer.settlementCount + increment;
            if (increment == -1 && targetPlayer.settlementCount == 0) {
                alert("Sorry, you have no Settlements left!");
            }
            else
                targetPlayer.settlementCount = enableNumPad ? newValue : targetPlayer.settlementCount + increment;
            break;
        case 1:     //Add a City means lose a Settlement, and vice-versa
            if (increment == 1 && targetPlayer.settlementCount == 0) {
                alert("Sorry, you can't upgrade to a City - you have no Settlements!");
            }
            else if (increment == -1 && targetPlayer.cityCount == 0) {
                alert("Sorry, you have no Cities left!");
            }               
            else {
                targetPlayer.cityCount+= increment;
                targetPlayer.settlementCount-= increment;
                }
            break;         
        case 2:
            if (increment == -1 && targetPlayer.activeKnightCount == 0) {
                alert("Sorry, you have no Knights left!");
            }            
            else
                targetPlayer.activeKnightCount+= increment;
            break;
        case 3:
            if (increment == -1 && targetPlayer.metropolisCount == 0) {
                alert("Sorry, you have no Metropolises left!");
            }            
            else            
                targetPlayer.metropolisCount+= increment;
            break;
        case 4:
            targetPlayer.victoryPoints+= increment;
            break;
        case 5:
            $.each(players, function (index, player) {
                player.hasMerchant = false;
            });               
            if (increment == 1) 
                targetPlayer.hasMerchant = true;
            break;
        case 6:
            $.each(players, function (index, player) {
                player.hasLongestRoad = false;
            }); 
            if (increment == 1) 
                targetPlayer.hasLongestRoad = true;
            break;
    }        

    //Update the UI now that the underlying data values have been updated
    updateBoard();

    decInProgress = false;
} 

function updateTotalCounts() {
    settlementCount = 0;
    cityCount = 0;
    activeKnightCount = 0;

    var highScore = 0;
    var highestActiveKnightCount = 0;
    var lowestActiveKnightCount = 100;

    $.each(players, function (index, player) {
        settlementCount += player.settlementCount;
        cityCount += player.cityCount;
        activeKnightCount  += player.activeKnightCount;

        player.totalPoints = 
            player.settlementCount +
            (player.cityCount * 2) +
            player.victoryPoints +
            (player.metropolisCount * 2) +  //counting Metropolis as its own 2-pointer on a 2-point city, vs. a 4-point entity
            (player.hasMerchant ? 1 : 0) +
            (player.hasLongestRoad ? 2 : 0);   
            
        if (player.totalPoints > highScore)
            highScore = player.totalPoints;        
            
        if (player.activeKnightCount < lowestActiveKnightCount)
            lowestActiveKnightCount = player.activeKnightCount;

        if (player.activeKnightCount > highestActiveKnightCount)
            highestActiveKnightCount = player.activeKnightCount;                          
    });

    var isProtected = (activeKnightCount >= cityCount);

    return {
        settlementCount: settlementCount,
        cityCount: cityCount,
        activeKnightCount: activeKnightCount,
        highScore: highScore,
        lowestActiveKnightCount: lowestActiveKnightCount,
        highestActiveKnightCount: highestActiveKnightCount,
        isProtected: isProtected
    };
}


function playSound(filename) {
    var sound = new Audio(filename);
    sound.play();    
}

//Show barbarian dialog when Barbarian button clicked
function barbarianAttack() {
    var totalCounts = updateTotalCounts();
    var barbarianLoserPlayers = [];
    var barbarianWinnerPlayers = [];
    var attackInfo = [];

    playSound("attackHey.mp3");
    setTimeout (function () {
        playSound("attack2.mp3");
    }, 500);

    //If not protected see if any player should lose an unMetropolised-city
    if (!totalCounts.isProtected) {
        $.each(players, function (index, player) {
            if (player.activeKnightCount == totalCounts.lowestActiveKnightCount) {
                //If this player has any un-metro'd city make them downgrade a City to a Settlement
                if ( (player.cityCount > 0) && (player.metropolisCount < player.cityCount) ) {
                    player.cityCount--;
                    player.settlementCount++;
                    barbarianLoserPlayers.push(player);
                }
            }
        });

        //Show lose-a-city reminder
        if (barbarianLoserPlayers.length > 0) {
            attackInfo.push("These players must downgrade 1 City to a Settlement:");
            attackInfo.push(barbarianLoserPlayers.map(p => p.firstName).join(", "));
        }
    }

    //If protected, one player has the most knights and we're protected, he gets a Victory Point
    //If >1 player ties for most knights, no Victory Points awarded (but then get a take-card reminder)
    else {
        $.each(players, function (index, player) {
            if (player.activeKnightCount == totalCounts.highestActiveKnightCount) {
                barbarianWinnerPlayers.push(player);
            }
        });

        //If only player with highest points, he gets a Victory Point
        if (barbarianWinnerPlayers.length == 1) {
            player = barbarianWinnerPlayers[0];
            player.victoryPoints++;
            attackInfo.push("This player wins the Barbarian Attack and gets a Victory Point!");
            attackInfo.push(player.firstName);
        }
        else {
            attackInfo.push("These players tied and get to pick a Progress Card:");
            attackInfo.push(barbarianWinnerPlayers.map(p => p.firstName).join(", "));
        }
    }

    //Show the info
        $("#attackInfo1").text(attackInfo[0]);
        $("#attackInfo2").text(attackInfo[1]);
        $(".attack").show();
        $(".diceDiv").hide();
        $(".board").hide();
        $("#mainButtons").hide();
    

    //Now reset all activeKnight counts to 0
    $.each(players, function (index, player) {
        player.activeKnightCount = 0;
    });

    updateBoard();    
}

function hideAttack() {
    $(".attack").hide();
    if (!disableDice) {
        $(".diceDiv").show();
    }    
    $(".board").show();
    $("#mainButtons").show();
}

function rollDice() {
  $("#diceSpan").hide();

 playSound("DiceRoll1.m4a"); 

 setTimeout (function () {
      debugger;
      var colorNum = Math.floor(Math.random() * 6) + 1;   
      var redNum = Math.floor(Math.random() * 6) + 1;  
      var stdNum = Math.floor(Math.random() * 6) + 1;
      var colorString = colorNum < 4 ? "black" : colorNum == 4 ? "blue" : colorNum == 5 ? "yellow" : "green"; 
      var colorText = (redNum + stdNum).toString();
      $("#rollDiceColor").css("background-color", colorString);
      $("#rollDiceColor").text(colorText);
      $("#rollDiceRed").text(redNum.toString());
      $("#rollDiceStd").text(stdNum.toString());
        
      $("#diceSpan").show(); 
  }, 1200);
    
}

//Update the UI using the latest underlying data
function updateBoard() {
    var totalCounts = updateTotalCounts();

    //Update cells in each row using latest player data
    $.each(rowIndexes, function (key, rowIndex) {
        curRow = $(".board tbody tr:eq(" + rowIndex + ")");
        curKey = key;

        var categoryCol = curRow.find("td:eq(0)");

        if (key == "settlements") {
            $(categoryCol).text("Settlements (" + totalCounts.settlementCount.toString() + ")");
        }
        
        else if (key == "cities") {
            $(categoryCol).text("Cities (" + totalCounts.cityCount.toString() + ")");
        }

        else if (key == "activeKnights") {
            $(categoryCol).text("Knight Pts (" + totalCounts.activeKnightCount.toString() + ")");

            //Set color as cities-protected or not using precalculated value based on city-count and knights-count
            var protectionClass = totalCounts.isProtected ? "protected" : "notProtected";
            $(categoryCol).attr("class", protectionClass);
        }

        $.each(players, function (index, player) {
            var playerCol = curRow.find("td:eq(" + player.index + ")");

            switch (curKey) {
                case "settlements":
                    playerCol.text(player.settlementCount.toString());
                    break;
                case "cities":
                    playerCol.text(player.cityCount.toString());
                    break;         
                case "activeKnights":
                    playerCol.text(player.activeKnightCount.toString());
                    break;
                case "metropolis":
                    playerCol.text(player.metropolisCount.toString());
                    break;
                case "victoryPoints":
                    playerCol.text(player.victoryPoints.toString());
                    break;
                case "merchant":
                    if (player.hasMerchant) 
                        playerCol.find("img").show();
                    else
                        playerCol.find("img").hide(); 
                    break;
                case "longestRoad":
                    if (player.hasLongestRoad) 
                        playerCol.find("img").show();
                    else
                        playerCol.find("img").hide(); 
                    break;
                case "totals":
                    playerCol.text(player.totalPoints.toString());
                    break;                               
            }
        });
    });

    //Color-highlight tied and leader(s) if any (applies to overall points and knight points)
    var tiedScores = [];
    var tiedKnightPoints = [];
    var tiedClass = "";
    var playerKnightPoints = [];
    var playerScores = [];
    $.each(players, function (index, player) {
        playerKnightPoints.push(player.activeKnightCount);
        playerScores.push(player.totalPoints);
    });

    $.each(players, function (index, player) {
        var playerNameCell = $(".board th:eq(" + (index+1).toString() + ")");
        var playerKnightCell = $(".board tbody tr:eq(2)").find("td:eq(" + (index+1).toString() + ")");
        var totalsCell = $(".board tr:last-child").find("td:eq(" + (index+1).toString() + ")");

        //Highlight tied-knight-points or knight-point leader
        tiedClass = "";
        var isTied = ((players.map(p => p.activeKnightCount)).filter(s => s == player.activeKnightCount).length > 1);
        if (isTied) {
            if (!tiedKnightPoints.includes(player.activeKnightCount)) {
                tiedKnightPoints.push(player.activeKnightCount);
            }
            //Only highlight knights points if > 0
            if (player.activeKnightCount > 0) {
                colorNum = tiedKnightPoints.indexOf(player.activeKnightCount) + 1;
                tiedClass = "tiedColor" + colorNum;
            }
        }   
        $(playerKnightCell).attr("class", tiedClass);

        if (!isTied && player.activeKnightCount == totalCounts.highestActiveKnightCount) {
            $(playerKnightCell).addClass("leader");
        }
        else {
            $(playerKnightCell).removeClass("leader");
        }

        //Highlight tied-overall-points or overall-point leader
        tiedClass = "defaultHighlightColor";
        var isTied = ((players.map(p => p.totalPoints)).filter(s => s == player.totalPoints).length > 1);
        if (isTied) {
            if (!tiedScores.includes(player.totalPoints)) {
                tiedScores.push(player.totalPoints);
            }
            colorNum = tiedScores.indexOf(player.totalPoints) + 1;
            tiedClass = "tiedColor" + colorNum;
        }   
        $(playerNameCell).attr("class", tiedClass);
        $(totalsCell).attr("class", tiedClass);

        if (!isTied && player.totalPoints == totalCounts.highScore) {
            $(playerNameCell).addClass("leader");
            $(totalsCell).addClass("leader");
        }
        else {
            $(playerNameCell).removeClass("leader");
            $(totalsCell).removeClass("leader");
        }

        //Show winner if any
        if (player.totalPoints >= pointsToWin) {
            showWinner(player.firstName);
        }
    });
}

