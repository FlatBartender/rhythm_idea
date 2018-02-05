const canvas = document.getElementById("main")
const ctx = canvas.getContext("2d")
const debug = document.getElementById("debug")

Number.prototype.linear_map = function (in_min, in_max, out_min, out_max) {
    return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min
}

// Time between start of appearance and perfect position
const APPROACH_RATE = 1000

class Note {
    constructor(ts_valid, valid_window, angle, width, affinity = Note.AFFINITY_ANY) {
        // ts_valid: perfect time to get the note
        this.ts_valid = ts_valid
        // speed: how much time (in milliseconds) it takes to go from appearance to perfect position
        this.speed = APPROACH_RATE
        // how much time it stays valid, determines thickness
        this.valid_window = valid_window
        // angle where this is valid
        this.angle = angle
        this.angle_start = angle - width/2
        this.angle_end   = angle + width/2
        // width of the note
        this.width = width
        let gradient_size = CIRCLE_RADIUS*0.1
        let x_inter = Math.cos(angle + Math.PI/2)*gradient_size
        let y_inter = Math.sin(angle + Math.PI/2)*gradient_size
        let x_start = GAME_CENTER_X + x_inter
        let y_start = GAME_CENTER_Y + y_inter
        let x_end   = GAME_CENTER_X - x_inter
        let y_end   = GAME_CENTER_Y - y_inter
        console.log(`x_start: ${x_start}, x_end = ${x_end}`)
        console.log(`y_start: ${y_start}, y_end = ${y_end}`)
        let gradient = ctx.createLinearGradient(x_start, y_start, x_end, y_end)
        switch (affinity) {
            case Note.AFFINITY_ANY:
                gradient.addColorStop(0.0, "rgba(0, 255, 0, 0.9)")
                gradient.addColorStop(1.0, "rgba(0, 255, 0, 0.9)")
                gradient.addColorStop(0.5, "rgba(0, 255, 0, 1)")
                break
            case Note.AFFINITY_RIGHT:
                gradient.addColorStop(0.0, "rgba(255, 255, 0, 0.9)")
                gradient.addColorStop(1.0, "rgba(255, 255, 0, 0.9)")
                gradient.addColorStop(0.5, "rgba(255, 255, 0, 1)")
                break
            case Note.AFFINITY_LEFT:
                gradient.addColorStop(0.0, "rgba(255, 0, 255, 0.9)")
                gradient.addColorStop(1.0, "rgba(255, 0, 255, 0.9)")
                gradient.addColorStop(0.5, "rgba(255, 0, 255, 1)")
                break
            case Note.AFFINITY_BOTH:
                gradient.addColorStop(0.0, "rgba(255, 0, 0, 0.9)")
                gradient.addColorStop(1.0, "rgba(255, 0, 0, 0.9)")
                gradient.addColorStop(0.5, "rgba(255, 0, 0, 1)")
                break
        }
        this.color = gradient
        this.affinity = affinity

        this.valid_start   = ts_valid - valid_window/2
        this.valid_end     = ts_valid + valid_window/2
        this.appear_start  = this.valid_start - APPROACH_RATE
        this.appear_end    = this.valid_end   - APPROACH_RATE
        this.travel_time   = this.ts_valid - this.appear_start
        this.max_thickness = CIRCLE_RADIUS / this.travel_time * valid_window

        this.update(0)
    }
    
    update(timestamp) {
        this.timestamp = timestamp
        let ts_valid     = this.ts_valid
        let speed        = this.speed
        let valid_window = this.valid_window
        let angle        = this.angle
        let width        = this.width
        let valid_start  = this.valid_start
        let valid_end    = this.valid_end
        let appear_start = this.appear_start
        let appear_end   = this.appear_end

        let values = {
            angle_start: angle - width/2,
            angle_end: angle + width/2,
            radius: 0,
            thickness: 0
        }

        let travel_time = this.appear_start
        let max_thickness = this.max_thickness
    
        // note didn't appear yet
        if (timestamp < appear_start) return values
        // appearance stage
        if (timestamp >= appear_start && timestamp <= appear_end) {
            let delta_appear = timestamp.linear_map(appear_start, appear_end, 0, 1)
            this.thickness = delta_appear * max_thickness
            this.radius = Math.ceil(this.thickness/2)
        }
        // propagation stage
        if (timestamp >= appear_end) {
            this.thickness = max_thickness
            this.radius = timestamp.linear_map(appear_end, ts_valid, Math.ceil(this.thickness/2), CIRCLE_RADIUS)
        }
    }

    display() {
        ctx.beginPath()
        ctx.arc(GAME_CENTER_X, GAME_CENTER_Y, this.radius, this.angle_start, this.angle_end)
        ctx.strokeStyle = this.collide() ? "white" : this.color
        ctx.lineWidth = this.thickness
        ctx.stroke()
        ctx.closePath()      
    }

    collide() {
        if (!this.collide_circle()) return false
        let left, right
        if (this.affinity & Note.AFFINITY_LEFT) {
            left  = this.collide_left()
        }
        if (this.affinity & Note.AFFINITY_RIGHT) {
            right = this.collide_right()
        }

        switch (this.affinity) {
            case Note.AFFINITY_LEFT:
                return left
            case Note.AFFINITY_RIGHT:
                return right
            case Note.AFFINITY_ANY:
                return left || right
            case Note.AFFINITY_BOTH:
                return left && right
        }
    }

    collide_circle() {
        return (this.radius + this.thickness/2) >= CIRCLE_RADIUS && (this.radius - this.thickness/2) <= CIRCLE_RADIUS
    }

    collide_left() {
        return arcs_intersection(leftCursorAngle - CURSOR_SIZE, leftCursorAngle + CURSOR_SIZE, this.angle, this.angle)
    }

    collide_right() {
        return arcs_intersection(rightCursorAngle - CURSOR_SIZE, rightCursorAngle + CURSOR_SIZE, this.angle, this.angle)
    }

    get missed() {
        if (this.timestamp > this.valid_end) return true
        return false
    }
}
Note.AFFINITY_LEFT  = 0b01
Note.AFFINITY_RIGHT = 0b10
Note.AFFINITY_ANY   = 0b11
Note.AFFINITY_BOTH  = 0b111
Note.LEFT_GRADIENT  = ctx.createLinearGradient 

let gp

window.addEventListener("gamepadconnected", (e) => {
    gp = navigator.getGamepads()[e.gamepad.index]
    console.log(gp)
})

const GAME_CENTER_X    = 400
const GAME_CENTER_Y    = 400
const CIRCLE_RADIUS    = 300
const CIRCLE_THICKNESS = 32
const CURSOR_SIZE      = Math.PI/8

let circle_gradient = ctx.createRadialGradient(GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS - CIRCLE_THICKNESS/2,
                                             GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS + CIRCLE_THICKNESS/2)
circle_gradient.addColorStop(0.0, "rgba(0, 0, 0, 0)")
circle_gradient.addColorStop(0.5, "lightgray")
circle_gradient.addColorStop(1.0, "rgba(0, 0, 0, 0)")

function game_circle() {
    ctx.beginPath()
    ctx.arc(GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS, 0, 2*Math.PI)
    ctx.strokeStyle = circle_gradient
    ctx.lineWidth = CIRCLE_THICKNESS
    ctx.stroke()
    ctx.closePath()
}

let left_gradient = ctx.createRadialGradient(GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS - CIRCLE_THICKNESS/2,
                                             GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS + CIRCLE_THICKNESS/2)
left_gradient.addColorStop(0.1, "rgba(255, 0, 255, 0)")
left_gradient.addColorStop(0.5, "magenta")
left_gradient.addColorStop(0.9, "rgba(255, 0, 255, 0)")

let right_gradient = ctx.createRadialGradient(GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS - CIRCLE_THICKNESS/2,
                                             GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS + CIRCLE_THICKNESS/2)
right_gradient.addColorStop(0.1, "rgba(255, 255, 0, 0)")
right_gradient.addColorStop(0.5, "yellow")
right_gradient.addColorStop(0.9, "rgba(255, 255, 0, 0)")

let intersect_gradient = ctx.createRadialGradient(GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS - CIRCLE_THICKNESS/2,
                                             GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS + CIRCLE_THICKNESS/2)
intersect_gradient.addColorStop(0.1, "rgba(255, 0, 0, 0)")
intersect_gradient.addColorStop(0.5, "red")
intersect_gradient.addColorStop(0.9, "rgba(255, 0, 0, 0)")


function cursor_left() {
    ctx.beginPath()
    ctx.arc(GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS, leftCursorAngle - CURSOR_SIZE, leftCursorAngle + CURSOR_SIZE)
    ctx.strokeStyle = left_gradient
    ctx.lineWidth = CIRCLE_THICKNESS
    ctx.stroke()
    ctx.closePath()
}

function cursor_right() {
    ctx.beginPath()
    ctx.arc(GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS, rightCursorAngle - CURSOR_SIZE, rightCursorAngle + CURSOR_SIZE)
    ctx.strokeStyle = right_gradient
    ctx.lineWidth = CIRCLE_THICKNESS
    ctx.stroke()
    ctx.closePath()
}

function arcs_intersection(a_start, a_end, b_start, b_end) {
    let left_start  = a_start % (Math.PI*2)
    let left_end    = a_end   % (Math.PI*2)
    let right_start = b_start % (Math.PI*2)
    let right_end   = b_end   % (Math.PI*2)
    let slide_left_start  = left_start  - 2*Math.PI
    let slide_left_end    = left_end    - 2*Math.PI
    let slide_right_start = right_start - 2*Math.PI
    let slide_right_end   = right_end   - 2*Math.PI
 
    let left_coll        = right_start <= left_end       && left_end <= right_end
    let slide_left_coll  = right_start <= slide_left_end && slide_left_end <= right_end
    let right_coll       = left_start <= right_end       && right_end <= left_end
    let slide_right_coll = left_start <= slide_right_end && slide_right_end <= left_end   

    let start = 0, end = 0
    
    if (left_coll) {
        start = right_start
        end = left_end
    } else if (right_coll) {
        start = left_start
        end = right_end
    } else if (slide_left_coll) {
        start = right_start
        end = slide_left_end
    } else if (slide_right_coll) {
        start = left_start
        end = slide_right_end
    } else return
    
    return {start, end}
}

function cursor_intersection() {
    let collision = arcs_intersection(leftCursorAngle  - CURSOR_SIZE, leftCursorAngle  + CURSOR_SIZE,
                                      rightCursorAngle - CURSOR_SIZE, rightCursorAngle + CURSOR_SIZE)

    if (collision) {
        let {start, end} = collision
        ctx.beginPath()
        ctx.arc(GAME_CENTER_X, GAME_CENTER_Y, CIRCLE_RADIUS, start, end)
        ctx.strokeStyle = intersect_gradient
        ctx.lineWidth = CIRCLE_THICKNESS
        ctx.stroke()
        ctx.closePath()
    }

}

function display_note(note_values)  {
    
}

function set_left_cursor() {
    let x = gp.axes[0]
    let y = gp.axes[1]
    if (x*x + y*y < 0.75) return
    leftCursorAngle = Math.atan2(y, x)
}

function set_right_cursor() {
    let x = gp.axes[2]
    let y = gp.axes[3]
    if (x*x + y*y < 0.2) return
    rightCursorAngle = Math.atan2(y, x)
}

let  leftCursorAngle = 0
let rightCursorAngle = 0

let simulation_fps
let render_fps

let notes = []

let score = 0
let missed = 1

let simulation_step = (function () {
    let start = 0
    let previous = start
    let previous_left = false
    let previous_right = false
    
    var note
    
    return function () {
        let timestamp = performance.now()
        if (!start) {
            start = timestamp
            note = new Note(2000, 1000, 0, Math.PI/8)
            notes.push(note)
        }
        let delta = timestamp - previous
        previous = timestamp

        simulation_fps = +(1000 / delta).toFixed(0)

        notes.forEach(note => note.update(timestamp - start))
        
        // Control

        // If we currently have a gamepad, get it's angle value (left stick)
        if (gp) {
            let left = gp.buttons[4].pressed
            let right = gp.buttons[5].pressed
            let left_high = false, right_high = false
            if (left && !previous_left) left_high = true
            if (right && !previous_right) right_high = true

            notes = notes.filter(note => {
                if ((note.affinity == Note.AFFINITY_ANY || note.affinity == Note.AFFINITY_LEFT) && left_high && 
                    note.collide_circle() && note.collide_left()) {
                    score++
                    return false
                }
                return true
            })
            notes = notes.filter(note => {
                if ((note.affinity == Note.AFFINITY_ANY || note.affinity == Note.AFFINITY_RIGHT) && right_high && 
                    note.collide_circle() && note.collide_right()) {
                    score++
                    return false
                }
                return true
            })
            notes = notes.filter(note => {
                if (note.affinity == Note.AFFINITY_BOTH && ((left && right_high) || (left_high && right) || (left_high && right_high)) && note.collide()) {
                    score++
                    return false
                }
                return true
            })
            previous_left = left
            previous_right = right
            set_left_cursor()
            set_right_cursor()
        }

        // Physics/Behavior
        notes = notes.filter(note => {   
            if (note.missed) {
                missed++
                return false
            }
            return true
        })
        if (notes.length == 0) {
            console.log("notes is empty")
            let affinity
            switch (Math.floor(Math.random()*4)) {
                case 0:
                    affinity = Note.AFFINITY_ANY
                    break
                case 1:
                    affinity = Note.AFFINITY_LEFT
                    break
                case 2:
                    affinity = Note.AFFINITY_RIGHT
                    break
                case 3:
                    affinity = Note.AFFINITY_BOTH
                    break
            }
            note = new Note(timestamp - start + 2000, 1000, Math.random() * 2 * Math.PI, Math.PI/8, affinity)
            notes.push(note)
        }

    }
})()

let render_step = (function () {
    let start = 0
    let previous = start

    return function (timestamp) {
        if (!start) start = timestamp
        let delta = timestamp - previous
        previous = timestamp

        render_fps = +(1000 / delta).toFixed(3)

        ctx.fillStyle = "black"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        game_circle()
        cursor_left()
        cursor_right()
        cursor_intersection()
        
        notes.forEach( note => note.display() )

        debug.innerText = `Score: ${score}\nMissed: ${missed}\nSimulation FPS: ${simulation_fps}\nRender FPS: ${render_fps}\nGameStamp: ${timestamp - start}`

        requestAnimationFrame(render_step)
    }
})()

let start = document.getElementById("start")
start.addEventListener("click", () => {
    setInterval(simulation_step, 10)
    requestAnimationFrame(render_step)
})
