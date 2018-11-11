/* Toggle between adding and removing the "responsive" class to topnav when the user clicks on the icon */
function toggleResponsive() {
	var x = document.getElementById("topNav");
	if (x.className === "nav") {
		x.className += " responsive";
	} else {
		x.className = "nav";
	}
}

//Database Code

function updateDBAndCache() {
	for (var reservationKey in reservationCache) {
		var nowInSec = Math.round(Date.now() / 1000);
		var timePassed = nowInSec - reservationCache[reservationKey]["startTime"];
		if (reservationCache[reservationKey]["status"] == 1 && timePassed >= SEC_PER_MATCH) {
			tableReservationsRef.child(reservationKey).remove();
			delete reservationCache[reservationKey];
		}
		else if (reservationCache[reservationKey]["status"] != 1) {
			var inPlayKey;
			var inPlayFound = false
			tableReservationsRef.orderByChild("status").on("child_added", function(snapshot) {
				var entry = snapshot.val();
				if (entry["status"] == 1 && entry["tableNo"] == reservationCache[reservationKey]["tableNo"]) {
					inPlayKey = snapshot.key;
					inPlayFound = true;
				}
			});

			var inPlayTimePassed = 0;
			if (inPlayFound) {
				tableReservationsRef.orderByChild("startTime").on("child_added", function(snapshot) {
					var entry = snapshot.val();
					inPlayTimePassed = nowInSec - entry["startTime"];
				});
			}

			if (inPlayTimePassed >= SEC_PER_MATCH || !inPlayFound) {
				reservationCache[reservationKey]["status"] -= 1;
				tableReservationsRef.child(reservationKey + "/status").set(reservationCache[reservationKey]["status"]);
			}
		}
	}
}

function loadCacheFromDB() {
	reservationCache = {};

	tableReservationsRef.orderByChild("name").on("child_added", function(snapshot) {
		var entry = snapshot.val();
		reservationCache[snapshot.key] = {
			"name": entry["name"],
			"tableNo": entry["tableNo"],
			"status": entry["status"],
			"startTime": entry["startTime"]
		}
	});
}

function clearDB() {
	var remove = tableReservationsRef.orderByChild("name").on("child_added", function(snapshot) {
		tableReservationsRef.child(snapshot.key).remove();
	});
	tableReservationsRef.off("child_added", remove);
}

function reserveTable() {
	var reservationName = document.getElementById("name").value;
	var tableNo = document.getElementById("tableNo").value;

	var startTime;
	var status;

	var peopleInQueue = 0;

	tableReservationsRef.orderByChild('tableNo').equalTo(tableNo).on("child_added", function(snapshot) {
		peopleInQueue++;
	});

	var inPlayKey;
	var inPlayFound = false;
	var nowInSec = Math.round(Date.now() / 1000);
	tableReservationsRef.orderByChild("status").equalTo(1).on("child_added", function(snapshot) {
		var entry = snapshot.val();
		if (entry["tableNo"] == tableNo) {
			inPlayKey = snapshot.key;
			inPlayFound = true;
		}
	});

	var inPlayTimePassed = 0;
	if (inPlayFound) {
		tableReservationsRef.orderByChild("startTime").on("child_added", function(snapshot) {
			var entry = snapshot.val();
			if (snapshot.key == inPlayKey) {
				inPlayTimePassed = nowInSec - entry["startTime"];
			}
		});
	}
	status = peopleInQueue + 1;
	startTime = nowInSec + (SEC_PER_MATCH * (status - 1)) - inPlayTimePassed;
	console.log(status);
	console.log(inPlayTimePassed);

	var newReservationRef = tableReservationsRef.push();
	var newReservationKey = newReservationRef.key;

	newReservationRef.set({
		"name": reservationName,
		"tableNo": tableNo,
		"status": status,
		"startTime": startTime
	});

	reservationCache[newReservationKey] = {
		"name" : reservationName,
		"tableNo": tableNo,
		"status": status,
		"startTime": startTime
	}
	//console.log(newReservationRef);
	//console.log(reservationCache);
}

function updateTable() {
	var oldTBody = table.getElementsByTagName("tbody")[0];
	var newTable = document.createElement("table");
	var header = newTable.insertRow(-1);
	header.innerHTML = table.rows[0].innerHTML;

	orderCache();

	for (var reservationKey in reservationCache) {
		var newRow = newTable.insertRow(-1);
		var tableCell = newRow.insertCell(-1);
		var nameCell = newRow.insertCell(-1);
		var statusCell = newRow.insertCell(-1);
		var timeCell = newRow.insertCell(-1);

		var tableNo = reservationCache[reservationKey]["tableNo"];
		var name = reservationCache[reservationKey]["name"];
		var status = reservationCache[reservationKey]["status"];
		var startTime = reservationCache[reservationKey]["startTime"];

		var nowInSec = Math.round(Date.now() / 1000);

		var timePassed = nowInSec - startTime;

		var timeLeft;

		if (status == 1) {
			status = "In Play!";
			timeLeft = SEC_PER_MATCH - timePassed;
		}
		else {
			status = "No. " + (status - 1) + " In Line.";
			timeLeft = -timePassed;
		}

		timeLeft = Math.floor(timeLeft / 60) + "M" + (timeLeft % 60) + "S";

		tableCell.innerText = tableNo;
		nameCell.innerText = name;
		statusCell.innerText = status;
		timeCell.innerText = timeLeft;
	}

	var newTBody = newTable.getElementsByTagName("tbody")[0];
	oldTBody.parentNode.replaceChild(newTBody, oldTBody);
}

function orderCache() {

}


//RANKING CODE

function loadRankingsCache() {
	playersRef.child(nextID + "").once("value", function(snapshot) {
  		var player = snapshot.val();
  		if (snapshot.exists()) {
  			var matchHistory = player.matchHistory;
  			var newMatchHistory = [];
  			for (matchIndex in matchHistory) {
  				var newMatch = matchHistory[matchIndex];
  				newMatchHistory.push(new Match(newMatch.pointsFor, newMatch.pointsAgainst));
  			}
  			var newPlayer = new Player(
  				player.firstName, 
  				player.lastName, 
  				nextID++, 
  				player.matchesWon, 
  				player.matchesLost, 
  				player.winStreak, 
  				player.winStreakBonus,
  				player.lossStreak,
  				player.lossStreakBonus,
  				newMatchHistory
  			);
  			players.add(newPlayer);
  			loadRankingsCache();
  		}
  		else {
  			players.rank();
  		}
  	});
}

function addPlayerClick() {
	var firstName = document.getElementById("firstName").value;
	var lastName = document.getElementById("lastName").value;
	var id = nextID++;

	var newPlayer = new Player(firstName, lastName, id);
	players.add(newPlayer);
	players.rank();

	var newPlayerRef = playersRef.child(id + ""); 
	console.log(newPlayer);
	newPlayerRef.set({
		"firstName" : newPlayer.firstName,
		"lastName" : newPlayer.lastName,
		"matchesWon" : newPlayer.matchesWon,
		"matchesLost" : newPlayer.matchesLost,
		"winStreak" : newPlayer.winStreak,
		"winStreakBonus" : newPlayer.winStreakBonus,
		"lossStreak" : newPlayer.lossStreak,
		"lossStreakBonus" : newPlayer.lossPerct,
		"dateJoined" : Date.now()
	});
	newPlayerRef.on('value', snapshot => {
	  console.log(snapshot.val());
	});
}

function addMatchClick() {
	var playerOneID = document.getElementById("playerOneAdd").value;
	var playerOneScore = document.getElementById("playerOneScore").value;
	var playerTwoID = document.getElementById("playerTwoAdd").value;
	var playerTwoScore = document.getElementById("playerTwoScore").value;

	players.finishMatch(playerOneID, playerOneScore, playerTwoID, playerTwoScore);

	var playerOne = players.getPlayerByID(playerOneID);
	var playerOneLatestMatchId = playerOne.matchHistory.length - 1;
	var playerOneLatestMatch = playerOne.matchHistory[playerOneLatestMatchId];
	var playerOneRef = playersRef.child(playerOneID);

	playerOneRef.update({
		"matchesWon" : playerOne.matchesWon,
		"matchesLost" : playerOne.matchesLost,
		"winStreak" : playerOne.winStreak,
		"winStreakBonus" : playerOne.winStreakBonus,
		"lossStreak" : playerOne.lossStreak,
		"lossStreakBonus" : playerOne.lossPerct
	});

	var playerOneMatches = playerOneRef.child("matchHistory");
	var playerOneNewMatch = playerOneMatches.child(playerOneLatestMatchId + "");

	playerOneNewMatch.set({
		"pointsFor" : playerOneLatestMatch.pointsFor,
		"pointsAgainst" : playerOneLatestMatch.pointsAgainst,
		"timePlayed" : Date.now()
	});

	var playerTwo = players.getPlayerByID(playerTwoID);
	var playerTwoLatestMatchId = playerTwo.matchHistory.length - 1;
	var playerTwoLatestMatch = playerTwo.matchHistory[playerTwoLatestMatchId];
	var playerTwoRef = playersRef.child(playerTwoID);

	playerTwoRef.update({
		"matchesWon" : playerTwo.matchesWon,
		"matchesLost" : playerTwo.matchesLost,
		"winStreak" : playerTwo.winStreak,
		"winStreakBonus" : playerTwo.winStreakBonus,
		"lossStreak" : playerTwo.lossStreak,
		"lossStreakBonus" : playerTwo.lossPerct
	});

	var playerTwoMatches = playerTwoRef.child("matchHistory");
	var playerTwoNewMatch = playerTwoMatches.child(playerTwoLatestMatchId + "");

	playerTwoNewMatch.set({
		"pointsFor" : playerTwoLatestMatch.pointsFor,
		"pointsAgainst" : playerTwoLatestMatch.pointsAgainst,
		"timePlayed" : Date.now()
	});
}


////////////////////////////////////////////////////////////
///                   SIMULATION CODE                    ///
////////////////////////////////////////////////////////////

const INIT_PT_VAL      = 50;
const EQ_PT_CHANGE     = 10;
const MIN_PT_GAIN      = 5;
const MIN_PT_LOSS      = 10;
const STREAK_START     = 3;
const WIN_STREAK_BASE  = 2;
const LOSS_PERCT_LOSS  = .05;
const MIN_PT           = 0;
const WEAK_MULTIPLIER  = .3;
const MIN_DIFF_FOR_MAX = 50;
const NUM_BARS_GRAPH   = 8;
const PENALTY_START    = 60;
const MAX_PT_DIFF_EQ   = 30;
const MAX_WIN_PERCT    = 60;
const BASE_CHANCE      = 50;
const PERCT_PER_DIFF   = .2;

class Match {
	constructor(pointsFor, pointsAgainst) {
		this.pointsFor = pointsFor;
		this.pointsAgainst = pointsAgainst;
		this.result = pointsFor == pointsAgainst ? "tie" : pointsFor > pointsAgainst ? "win" : "loss";
	}
}

class Player { 

	constructor(firstName, lastName, ID, matchesWon = 0, matchesLost = 0, winStreak = 0, winStreakBonus = 0, lossStreak = 0, lossStreakBonus = 1, matchHistory = []) {
		this.firstName = firstName;
		this.lastName = lastName;
		this.ID = ID;
		this.points = INIT_PT_VAL;
		this.matchesWon = matchesWon;
		this.matchesLost = matchesLost;
		this.winStreak = winStreak;
		this.winStreakBonus = winStreakBonus;
		this.lossStreak = lossStreak;
		this.lossPerct = lossStreakBonus;
		this.matchHistory = matchHistory;
	}

	get description() {
		return this.firstName + " " + this.lastName + " " + this.ID + " " + this.points;
	}

	get name() {
		return this.firstName + " " + this.lastName;
	}

	finishMatch(opponent, win) {
		this.points += this.getPointChange(opponent, win);

		this.points = parseInt(this.points, 10);

		if (this.points < MIN_PT) {
			this.points = MIN_PT;
		}
	}

	getPointChange(opponent, win) {
		var change = EQ_PT_CHANGE;
		var pointDiff = Math.abs(this.points - opponent.points)
		var max_change = pointDiff / 2;

		if (pointDiff >= MIN_DIFF_FOR_MAX && change > pointDiff / 2) {
			change = pointDiff / 2;
		}

		if (win) {
			this.matchesWon++;
			this.winStreak++;
			this.winStreakBonus += WIN_STREAK_BASE;

			if (pointDiff > MAX_PT_DIFF_EQ) {
				if (this.points < opponent.points) {
					change += pointDiff * WEAK_MULTIPLIER;
				}

				else if (this.points > opponent.points) {
					change -= (pointDiff - 50) / 10;
				}
			}

			if (change > 0 && change < MIN_PT_GAIN) {
				change = MIN_PT_GAIN;
			}

			if (this.winStreak >= STREAK_START) {
				change += this.winStreakBonus;
			}

			if (this.lossStreak > 0) {
				this.lossPerct = 1;
				this.lossStreak = 0;
			}
		}
		else {
			this.matchesLost++;
			this.lossStreak++;

			if (change < MIN_PT_LOSS) {
				change = MIN_PT_LOSS;
			}

			change = -change;

			if (this.lossPerct > 0) {
				this.lossPerct -= LOSS_PERCT_LOSS;
			}

			if (this.lossStreak >= STREAK_START) {
				change = change * this.lossPerct;
			}

			if (this.winStreak > 0) {
				this.winStreak = 0;
				this.winStreakBonus = 0;
			}
		}

		return change;
	}

	static compare(playerOne, playerTwo) {
		if (playerOne.points > playerTwo.points)
			return -1;
		if (playerOne.points < playerTwo.points)
			return 1;
		return 0;
	}
}

class Players {
	constructor() {
		this.list = [];
	}

	add(player) {	
		this.list.push(player);
		this.rank();
	}

	get count() {
		return this.list.length;
	}

	graphData() {
		let rawInterval = this.list[0].points / NUM_BARS_GRAPH;
		var interval = Math.ceil(rawInterval / 5) * 5;

		if (interval < 5) {
			interval = 5;
		}

		var data = [];
		var index = this.count - 1;
		var currCount = 0;
		for (var i = 1; i <= NUM_BARS_GRAPH; i++) {
			currCount = 0;
			for (; index >= 0 && (i == NUM_BARS_GRAPH || this.list[index].points < interval * i); index--) {
				currCount++;
			}
			data.push({x: i, y: currCount, label: ((i - 1) * interval) + "-" + (i * interval - 1)});
		}
		return data;
	}

	getPlayerByID(ID) {
		for (var i = 0; i < this.count; i++) {
			if (this.list[i].ID == ID) {
				return this.list[i];
			}
		}
		return null;
	}

	finishMatch(playerOneID, playerOneScore, playerTwoID, playerTwoScore) {
		var playerOne = this.getPlayerByID(playerOneID);
		var playerTwo = this.getPlayerByID(playerTwoID);

		var playerOneWin = playerOneScore > playerTwoScore;

		playerOne.finishMatch(playerTwo, playerOneWin);
		playerOne.matchHistory.push(new Match(playerOneScore, playerTwoScore));
		playerTwo.finishMatch(playerOne, !playerOneWin);
		playerTwo.matchHistory.push(new Match(playerTwoScore, playerOneScore));
		this.rank();
	}

	rank() {
		this.list.sort(Player.compare);
		var table = document.getElementById("rankingsTable");
		var rows = table.rows;
		var i = rows.length;
		while (--i) {
			table.deleteRow(i);
		}
		i = 0;
		var currRow, rankCell, nameCell, pointCell, winLossCell;
		for (; i < this.count; i++) {
			currRow = table.insertRow(-1);
			rankCell = currRow.insertCell(0);
			nameCell = currRow.insertCell(1);
			pointCell = currRow.insertCell(2);
			winLossCell = currRow.insertCell(3);
			rankCell.innerHTML = i + 1;
			nameCell.innerHTML = this.list[i].name;
			pointCell.innerHTML = this.list[i].points;
			winLossCell.innerHTML = this.list[i].matchesWon + "-" + this.list[i].matchesLost;
		}
	}
}

class SimPlayer extends Player {
	constructor(index) {
		super("Player", index, index);
		this.skill = 0;
	}

	finishMatch(opponent, win) {
		super.finishMatch(opponent, win);
	}
}

class Simulation extends Players {
	constructor(numPlayers) {
		super();

		for (var i = 1; i <= numPlayers; i++) {
			this.add(new SimPlayer(i));
		}
	}

	get initTotalPoint() {
		return this.count * INIT_PT_VAL;
	}

	get totalPoint() {
		return this.list.reduce((total, currSim, index, sims) => {
			return total += currSim.points;
		}, 0);
	}
	get range() {
		return this.list[0].points - this.list[this.count - 1].points;
	}

	reset(numPlayers) {
		this.list = [];
		for (var i = 1; i <= numPlayers; i++) {
			this.add(new SimPlayer(i));
		}
	}

	doMatch(playerOne, playerTwo) {
		var playerOneWin = Math.floor(Math.random() * 2 + 1) == 1;
		playerOne.finishMatch(playerTwo, playerOneWin);
		playerTwo.finishMatch(playerOne, !playerOneWin);
	}

	doFavoredMatch(playerOne, playerTwo) {
		var pointDiff = Math.abs(playerOne.points - playerTwo.points);
		var randVal = Math.random() * 100;
		var chanceDivision = BASE_CHANCE + PERCT_PER_DIFF * pointDiff;

		if (chanceDivision > MAX_WIN_PERCT) {
			chanceDivision = MAX_WIN_PERCT;
		}

		var morePtWon = randVal < chanceDivision;
		var playerOneMorePt = playerOne.points > playerTwo.points;

		playerOne.finishMatch(playerTwo, (playerOneMorePt && morePtWon) || !(playerOneMorePt || morePtWon));
		playerTwo.finishMatch(playerOne, !((playerOneMorePt && morePtWon) || !(playerOneMorePt || morePtWon)));
	}

	doAllMatches() {
		for (var i = 0; i < this.count; i++) {
			for (var j = i; j < this.count; j++) {
				this.doMatch(this.list[i], this.list[j]);
			}
		}
	}

	doMatchedMatches() {
		for (var i = 0; i < this.count - 1; i +=2) {
			this.doFavoredMatch(this.list[i], this.list[i + 1]);
		}

		if (this.count % 2 != 0) {
			this.doFavoredMatch(this.list[this.count - 2], this.list[this.count - 1]);
		}
	}
}