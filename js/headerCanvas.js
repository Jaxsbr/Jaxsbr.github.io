// This should animate when the header section is mostly in view.
// When moved of the header to the next section when should gracefull exit the animation and stop the requestAnimation.

let canvas = document.getElementById('headerCanvas');
let ctx = canvas.getContext('2d');
let canvasBounds = {x:0, y:0, w:0, h:0};
let animateHeaderCanvas = true;
let points = [];
let delta = 0;
let then = Date.now();
let dayCycle;
let seasonSimulator;

window.addEventListener('load', function () { 
    initCanvas();

    dayCycle = new DayCycle();
    seasonSimulator = new SeasonSimulator();

    initLoop();    
});

window.addEventListener('resize', function () { 
    initCanvas();
});

function initCanvas() {
    canvasBounds.x = 0;
    canvasBounds.y = 0;
    canvasBounds.w = canvas.width;
    canvasBounds.h = canvas.height;
};

function initLoop() {
    if (animateHeaderCanvas) { requestAnimationFrame(initLoop); }
    updateDelta();
    update();
    render();
};

function updateDelta() {	
    var now = Date.now();
    var newDelta = now - then;
    delta = newDelta / 1000;
    then = now;
};

function update() {
    dayCycle.update(delta);
    seasonSimulator.update(delta);
};

function render() {    
    ctx.clearRect(canvasBounds.x, canvasBounds.y, canvasBounds.w, canvasBounds.h);

    seasonSimulator.render(ctx, canvasBounds);
    dayCycle.render(ctx, canvasBounds);    
};



// DAY CYCLE
// ===============================================

DayCycle = function() {
    this.elapsed = 0;
    this.elapsedMax = 24;
    this.morning = 6;
    this.midday = 13;
    this.evening = 19;
    this.lightLevel = 1;
};

DayCycle.prototype.update = function(delta) {

    this.elapsed += delta;
    if (this.elapsed >= this.elapsedMax) {
        this.elapsed = 0;
    }

    if (this.elapsed >= this.morning && this.elapsed < this.midday) {
        // Calculate brightness
        let range = this.midday - this.morning;
        let current = this.midday - this.elapsed;    
        this.lightLevel = ((current * 100) / range) / 100;
    }
    else if (this.elapsed >= this.midday && this.elapsed < this.evening) {
        // Calculate brightness
        let range = this.evening - this.midday;
        let current = this.evening - this.elapsed;    
        this.lightLevel = 1 - ((current * 100) / range) / 100;
    }
    else {
        // Dark
        this.lightLevel = 1;
    }

};

DayCycle.prototype.render = function(ctx, canvasBounds) {
    let center = { x: canvasBounds.w / 2, y: canvasBounds.h / 2 };
    let radius = canvasBounds.w / 2;
    let gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);

    gradient.addColorStop(0, 'black');
    gradient.addColorStop(1, 'transparent');

    ctx.save();
    ctx.globalAlpha = this.lightLevel;
    ctx.fillStyle = gradient;
    ctx.fillRect(canvasBounds.x, canvasBounds.y, canvasBounds.w, canvasBounds.h);
    ctx.restore();

    // ctx.fillStyle = 'yellow';
    // ctx.font = '10px Georgia';
    // ctx.fillText(this.lightLevel.toString(), 0, 10);
};



// SEASON SIMULATOR
// ===============================================

SeasonSimulator = function() {    
    this.seasonSummer = 1;
    this.seasonAutum = 2;
    this.seasonWinter = 3;
    this.seasonSpring = 4;

    this.season = this.seasonSummer;
    this.color = 'lightgreen';

    this.seasonElapsed = 0;
    this.seasonElapsedMax = 24;
};

SeasonSimulator.prototype.toggleSeason = function(season) {
    this.season = season;    
};

SeasonSimulator.prototype.setNextSeason = function() {
    switch (this.season) {
        case this.seasonSummer:
        this.toggleSeason(this.seasonAutum);
        break;
        case this.seasonAutum:
        this.toggleSeason(this.seasonWinter);
        break;
        case this.seasonWinter:
        this.toggleSeason(this.seasonSpring);
        break;        
        case this.seasonSpring:
        this.toggleSeason(this.seasonSummer);
        break;
    }    
};

SeasonSimulator.prototype.setSeasonColor = function() {
    switch (this.season) {
        case this.seasonSummer:
        this.color = '#79c476';
        break;
        case this.seasonAutum:
        this.color = '#f6fca4';
        break;
        case this.seasonWinter:
        this.color = '#6b67a3';
        break;        
        case this.seasonSpring:
        this.color = '#76bbc4';
        break;
    }
};

SeasonSimulator.prototype.update = function(delta) {
    this.seasonElapsed += delta;
    if (this.seasonElapsed >= this.seasonElapsedMax) {
        this.seasonElapsed = 0;
        this.setNextSeason();
        this.setSeasonColor();
    }

    switch (this.season) {
        case this.seasonSummer:
        
        break;
        case this.seasonAutum:
        
        break;
        case this.seasonWinter:
        
        break;        
        case this.seasonSpring:
        
        break;
    }
};

SeasonSimulator.prototype.render = function(ctx, canvasBounds) {
    let center = { x: canvasBounds.w / 2, y: canvasBounds.h / 2 };
    let radius = canvasBounds.w / 2;
    let gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);

    gradient.addColorStop(0, this.color);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.fillRect(canvasBounds.x, canvasBounds.y, canvasBounds.w, canvasBounds.h);    
};