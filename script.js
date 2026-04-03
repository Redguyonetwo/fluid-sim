const canvas = document.getElementById('canvas')

const ctx = canvas.getContext('2d')

canvas.width = innerWidth
canvas.height = innerHeight

ctx.translate(0, innerHeight)
ctx.scale(1, -1)

ctx.font = '30px Arial'

ctx.lineWidth = 5

const halfX = innerWidth / 2
const halfY = innerHeight / 2

const balls = []

const properties = []

const densities = []

const spatialCells = []

let startIndices = new Array(10000).fill(-1)

const cellOffsets = [
    {x: -1, y: -1},
    {x: 0, y: -1},
    {x: 1, y: -1},
    {x: -1, y: 0},
    {x: 0, y: 0},
    {x: 1, y: 0},
    {x: -1, y: 1},
    {x: 0, y: 1},
    {x: 1, y: 1}
]

const x = 400
const y = 500
const ir = 100
const irSq = ir * ir

const gravity = -200;

let targetDensity = 0.002

let minDensity = targetDensity * 0.1

let maxMult = 1 / minDensity

let pressureMult = 1e6

for (let i = 0; i < 1000; i++) {
    let x = Math.random() * innerWidth * 0.95 + innerWidth * 0.025
    let y = Math.random() * innerHeight * 0.95 + innerHeight * 0.025
    balls[i] = {
        x,
        y,
        vx: 0,
        vy: 0,
        r: 5,//Math.round(Math.random() * 50) + 10,
        e: 0.9
    }

    properties[i] = (getProperty(x, y))

    densities[i] = getDensity(x, y, ir)
}

function circle(x, y, r, colour) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = colour
    ctx.fill()
}

function text(text, x, y) {
    ctx.save()
    ctx.scale(1, -1)
    ctx.translate(0, -innerHeight)
    ctx.fillStyle = 'black'
    ctx.fillText(text, x, y)
    ctx.restore()
}

function arrow(x1, y1, x2, y2) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = 'rgb(0, 150, 0)'
    ctx.stroke()

    circle(x2, y2, 5, 'rgb(0, 180, 0)')
}

let lastTime = performance.now()

console.log(balls.length, properties.length)

function smoothInfluence(distance) {
    if (distance >= ir) return 0;

    let volume = Math.PI * Math.pow(ir, 4) / 6;

    let value = ir - distance

    if (value < 0) return 0;

    else return value * value / volume;
}

function smoothInfluenceDerivative(distance) {
    if (distance >= ir) return 0;

    let f = ir - distance

    let scale = 12 / (Math.PI * Math.pow(ir, 4))

    return scale * f;
}

function getProperty(x, y) {
    return Math.cos(y - 30 + Math.sin(x))
}

function getSmoothProperty(x, y) {
    let property = 0;

    let mass = 1;

    for (let i in balls) {
        let ball = balls[i]
        let dx = x - ball.x;
        let dy = y - ball.y;

        let distSq = dx * dx + dy * dy

        if (distSq > irSq) continue;

        let distance = Math.sqrt(distSq)

        let influence = smoothInfluence(ir, distance)

        let density = densities[i] //getDensity(x, y, influenceRadius)

        let v = properties[i] * influence * mass / density

        property += (density == 0 ? 0 : v);
    }

    return property;
}

function getForce(index) {
   let property = {x: 0, y: 0};

    let mass = 1;

    let {x, y} = balls[index]
    let d = densities[index]

    for (let i in balls) {
        let ball = balls[i]
        let dx = x - ball.x;
        let dy = y - ball.y;

        let distSq = dx * dx + dy * dy

        if (distSq > irSq || distSq == 0) continue;

        let distance = Math.sqrt(distSq)

        dx /= distance
        dy /= distance

        let slope = smoothInfluenceDerivative(distance)

        let density = densities[i] //getDensity(x, y, influenceRadius)

        if (density == 0) continue;

        //console.log(properties[i])

        let pressure = getSharedPressure(density, d)

        let scalar = pressure * slope * mass / density

        if (isNaN(scalar)) continue;

        property.x += scalar * dx
        property.y += scalar * dy
    }

    return property;
}

function setMag(v, m) {
    let m_o = Math.sqrt(v.x * v.x + v.y * v.y)

    let mult = m / m_o

    return {x: v.x * mult, y: v.y * mult}
}

function getDensity(x, y) {
    let density = 0;
    let mass = 1;

    for (let b of balls) {
        let dx = (x - b.x)
        let dy = (y - b.y)

        let distSq = dx * dx + dy * dy
        if (distSq > irSq) continue;

        let distance = Math.sqrt(distSq)
        //console.log(distance)
        let influence = smoothInfluence(distance)
        density += mass * influence;
    }

    return density;
}

function getPressure(density) {
    let dx = density - targetDensity
    return dx * pressureMult
}

function getSharedPressure(d1, d2) {
    let p1 = getPressure(d1)
    let p2 = getPressure(d2)
    return (p1 + p2) * 0.5
}

function toCell(x, y) {
    return {x: Math.floor(x / ir), y: Math.floor(y / ir)}
}

function cellHash(x, y) {
    return (Math.abs(x * 73856093) ^ Math.abs(y * 19349663)) % 10000;
}

function updateSpatial() {
    spatialCells.length = 0;
    startIndices.fill(-1)

    for (let i = 0; i < balls.length; i++) {
        let {x, y} = toCell(balls[i].x, balls[i].y)

        let key = cellHash(x, y)

        spatialCells[i] = {index: i, key}
    }

    spatialCells.sort((a, b) => a.key - b.key)

    for (let i = 0; i < balls.length; i++) {
        let {key} = spatialCells[i]

        let keyPrev = i > 0 ? spatialCells[i - 1].key : -1

        if (key != keyPrev) {
            //console.log(i, key, keyPrev)
            startIndices[key] = i;
        }
    }
    //console.log(spatialCells)
    //console.log(startIndices)
}

function getForceSpatial(index) {
    let d = densities[index];
    let mass = 1;
    let {x, y} = balls[index]
    let {x: cellX, y: cellY} = toCell(x, y)
    let f = {x: 0, y: 0}

    for (let {x: offsetX, y: offsetY} of cellOffsets) {
        let newX = cellX + offsetX
        let newY = cellY + offsetY
        if (newX < 0 || newY < 0) continue;
        let key = cellHash(newX, newY)

        //if (key < 0 || isNaN(key)) continue;

        let startIndex = startIndices[key]

        if (startIndex < 0) continue;

        for (let i = startIndex; i < spatialCells.length; i++) {
            let cell = spatialCells[i]

            if (cell.key != key) break;

            let p = balls[cell.index]

            let dx = x - p.x
            let dy = y - p.y

            let distSq = dx * dx + dy * dy

            if (distSq > irSq) continue;

            // Do something

            let distance = Math.sqrt(distSq)

            if (distance > 0) {
                dx /= distance
                dy /= distance
            }
            else {
                dx = Math.random() - 0.5
                dy = Math.random() - 0.5
            }

            let slope = smoothInfluenceDerivative(distance)
            let density = densities[cell.index]
            let pressure = getSharedPressure(density, d)

            let scalar = pressure * slope * mass / density

            f.x += scalar * dx
            f.y += scalar * dy
        }
    }

    return f;
}

function getDensitySpatial(x, y) {
    let density = 0
    let mass = 1;
    let {x: cellX, y: cellY} = toCell(x, y)

    for (let {x: offsetX, y: offsetY} of cellOffsets) {
        let newX = cellX + offsetX
        let newY = cellY + offsetY
        if (newX < 0 || newY < 0) continue;
        let key = cellHash(newX, newY)

        //if (key < 0 || isNaN(key)) continue;

        let startIndex = startIndices[key]

        if (startIndex < 0) continue;

        //console.log('start', startIndex)

        for (let i = startIndex; i < spatialCells.length; i++) {
            let cell = spatialCells[i]

            if (cell.key != key) break;

            let p = balls[cell.index]

            let dx = x - p.x
            let dy = p.y - y

            let distSq = dx * dx + dy * dy

            if (distSq > irSq) continue;

            // Do something

            let distance = Math.sqrt(distSq)
            let influence = smoothInfluence(distance)
            density += mass * influence
        }
    }

    return density
}

let cellSize = 20

let arrowLen = cellSize * 0.6

setTimeout(() => {
    console.log('trying now')
    let start = performance.now()

for (let x = 0; x <= innerWidth; x += cellSize) {
    for (let y = 0; y <= innerHeight; y += cellSize) {
        let colour = getColour(getDensity(x, y), targetDensity)

        ctx.fillStyle = colour

        ctx.fillRect(x, y, cellSize, cellSize)
    }
}

console.log('initialised in', (performance.now() - start).toFixed(2), 'ms')

// console.log(balls[0])
// console.log(getForce(0, ir))
// console.log(getPressure(densities[0]))

requestAnimationFrame(update)

return;

for (let i in balls) {
    let ball = balls[i]
    let property = properties[i]

        let colourN = property * 0.5 + 0.5

        colourN = Math.round(colourN * 255)

        let colour = `rgb(${colourN}, ${colourN}, ${colourN})`

        //console.log(colour)
    circle(ball.x, ball.y, ball.r, 'rgba(255, 0, 0, 0.5)')
}

}, 3_000)

function update(timestamp) {
    requestAnimationFrame(update)
    
    //if (!started) return;

    updateSpatial()

    //console.log('running')

    let dt = (timestamp - lastTime) / 1000

    if (dt > 0.1) dt = 0.1

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let x = 0; x <= innerWidth; x += cellSize) {
        for (let y = 0; y <= innerHeight; y += cellSize) {
            const d = getDensitySpatial(x, y)

            let colour = getColour(d, targetDensity)

            ctx.fillStyle = colour

            ctx.fillRect(x, y, cellSize, cellSize)
        }
    }
    // Update densities first, using new spatial data
    for (let i = 0; i < balls.length; i++) {
        densities[i] = getDensitySpatial(balls[i].x, balls[i].y);
    }

    for (let i = 0; i < balls.length; i++) {
        let ball = balls[i]
        ball.vy += gravity * dt

        let force = getForceSpatial(i)

        let mult = 1 / densities[i]

        if (mult > maxMult) {
            mult = maxMult
        }

        force.x *= mult
        force.y *= mult

        //console.log(gradient)
        
        ball.vx += force.x * dt
        ball.vy += (force.y) * dt
        //else console.log(i)

        //console.log(ball.vx, ball.vy)

       

        ball.x += ball.vx * dt
        ball.y += ball.vy * dt

        ball.vx *= 0.95
        ball.vy *= 0.95

        //console.log(ball.x, ball.y)

        collide(ball)

        circle(ball.x, ball.y, ball.r, i == 0 ? 'lime' : 'black')
    }

    //console.log(densities[0], targetDensity)

    //circle(x, y, ir, 'rgba(100,100,255,0.5)')
    text((1/dt).toFixed(1), 100, 100)

    lastTime = timestamp
}

function collide(b) {
    if (b.x <= b.r) {
        b.x = b.r
        if (b.vx < 0) {
            b.vx *= -b.e
        }
    }
    else if (b.x >= canvas.width - b.r) {
        b.x = canvas.width - b.r
        if (b.vx > 0) {
            b.vx *= -b.e
        }
    }

    if (b.y <= b.r) {
        b.y = b.r
        if (b.vy < 0) {
            b.vy *= -b.e
        }
    }
    else if (b.y >= canvas.height - b.r) {
        b.y = canvas.height - b.r
        if (b.vy > 0) {
            b.vy *= -b.e
        }
    }
}

function lerp(a, b, t) {
    return a + (b-a) * t
}

function getColour(d, target) {
    let r = 255
    let g = 100
    let b = 255
    
    let t = (d - target) / target

    if (t >= 0 && t <= 1) {
        b = lerp(b, 0, t) // Removing blue will make it more red
    }
    else if (t >= -1 && t <= 0) {
        r = lerp(r, 0, -t) // Removing red will make it more blue
    }
    else if (t > 0) {
        return 'red' // Way too much, just full red
    }
    else {
        return 'blue' // Way too little, just blue
    }

    g = Math.min(r, b)

    return `rgb(${r}, ${g}, ${b})`
}