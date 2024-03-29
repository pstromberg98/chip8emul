const fs = require('fs');
const process = require('process');

const rom = fs.readFileSync(__dirname + '/app.rom');
const state = {
    i: 0,
    pc: 0,
    sp: 0,
    stack: Buffer.alloc(32).fill(0),
    memory: Buffer.alloc(4095).fill(0),
    display: new Display(),
    dt: 0,
};

// Decrement dt at 60hz
setInterval(() => {
    if (state.dt > 0) {
        state.dt--;
    }
}, 17);

// Sets up general purpose registers
for (let i = 0; i < 16; i++) {
    state[`v${i}`] = 0;
}
console.log(JSON.stringify(state));

// const stdin = process.openStdin(); 

// stdin.on('keypress', (chunk, key) => {
//     keysDown[key.name] = true;
// });

// stdin.on('keyup', (chunk, key) => {
//     keysDown[key.name] = false;
// });

async function executeInstruction(state, instruction) {
    console.log(instruction.toString(16));
    if (instruction[0] === 0 && instruction[1] == 0xE0) {
        // CLR: Clear Screen
        state.display.clear();
        state.pc += 2;
        console.log('Clear Screen!');
    } else if (instruction[0] === 0 && instruction[1] == 0xEE) {
        // RET: Return from subroutine
        state.pc = state.stack[state.sp];
        console.log('Set PC: ', state.pc);
        console.log('SP ', state.sp);
        state.sp--;
    } else if (instruction[0] >> 4 == 0x00) {
        // SYS addr
        // Jump to a machine code routine at nnn. Meant to be ignored
        console.warn('This instruction is being ignored...');
        state.pc += 2;
    } else {
        switch (instruction[0] >> 4) {
            case 0x1:
                // JMP
                state.pc = ((instruction[0] & 0xF) << 8) | instruction[1];
                break;
            case 0x2:
                // CALL
                state.sp++;
                state.stack[state.sp] = state.pc;
                state.pc = ((instruction[0] & 0xF) << 8) | instruction[1];
                break;
            case 0x3:
                // SE Vx, byte
                // Compares register Vx to kk, if equal, increment program counter by 2
                if (state[`v${instruction[0] & 0xF}`] === instruction[1]) {
                    state.pc += 2;
                }
                state.pc += 2;
                break;
            case 0x4:
                // SNE Vx, byte
                // Compares register Vx to kk, if not equal, increment program counter by 2
                if (state[`v${instruction[0] & 0xF}`] !== instruction[1]) {
                    state.pc += 2;
                }
                state.pc += 2;
                break;
            case 0x5:
                // SE Vx, Vy
                // Compares register Vx to Vy, if equal, increment program counter by 2
                if (state[`v${instruction[0] & 0xF}`] === state[`v${instruction[0] >> 4}`]) {
                    state.pc += 2;
                }
                state.pc += 2;
                break;
            case 0x6:
                // Set Vx = kk
                // The interpreter puts the value kk into register Vx
                state[`v${instruction[0] & 0xF}`] = instruction[1];
                state.pc += 2;
                break;
            case 0x7:
                // Set Vx = Vx + kk.
                // Adds the value kk to the value of register Vx, then stores the result in Vx
                state[`v${instruction[0] & 0xF}`] += instruction[1];
                state.pc += 2;
                break;
            case 0x8:
                const lastByte = instruction[1] & 0xF;
                const xReg = state[`v${instruction[0] & 0xF}`];
                const yReg = state[`v${instruction[1] >> 4}`];

                if (lastByte === 0) {
                    // LD Vx, Vy
                    state[`v${instruction[0] & 0xF}`] = yReg;
                } else if (lastByte === 1) {
                    // OR Vx, Vy
                    state[`v${instruction[0] & 0xF}`] = xReg | yReg;
                } else if (lastByte === 2) {
                    // AND Vx, Vy
                    state[`v${instruction[0] & 0xF}`] = xReg & yReg;
                } else if (lastByte === 3) {
                    // XOR Vx, Vy
                    state[`v${instruction[0] & 0xF}`] = xReg ^ yReg;
                } else if (lastByte === 4) {
                    // ADD Vx, Vy
                    const added = xReg + yReg;
                    if (added > 255) {
                        state['v15'] = 1;
                    } else {
                        state['v15'] = 0;
                    }

                    // Only the lowest 8 bits of the result are kept, and stored in Vx.
                    state[`v${instruction[0] & 0xF}`] = added & 0xF;
                } else if (lastByte === 5) {
                    // Set Vx = Vx - Vy
                    state['v15'] = xReg > yReg ? 1 : 0;
                    state[`v${instruction[0] & 0xF}`] = xReg - yReg;
                } else if (lastByte === 6) {
                    // Set Vx = Vx SHR 1
                    // If the least-significant bit of Vx is 1, then VF is set to 1, otherwise 0. Then Vx is divided by 2
                    if ((xReg & 0x01) != 0) {
                        state['v15'] = 1;
                    } else {
                        state['v15'] = 0;
                    }

                    state[`v${instruction[0] & 0xF}`] = xReg >> 1;
                } else if (lastByte === 7) {
                    // Set Vx = Vx - Vy
                    state['v15'] = yReg > xReg ? 1 : 0;
                    state[`v${instruction[0] & 0xF}`] = yReg - xReg;
                } else if (lastByte === 14) {
                    // If the most-significant bit of Vx is 1, then VF is set to 1, otherwise to 0. Then Vx is multiplied by 2
                    if ((xReg & 0x80) != 0) {
                        state['v15'] = 1;
                    } else {
                        state['v15'] = 0;
                    }

                    state[`v${instruction[0] & 0xF}`] = xReg * 2;
                } else {
                    
                }
                state.pc += 2;
                break;
            case 0x9:
                // Skip next instruction if Vx != Vy.
                if (state[`v${instruction[0] & 0xF}`] != state[`v${instruction[1] >> 4}`]) {
                    state.pc += 2;
                }
                state.pc += 2;
                break;
            case 0xA:
                state.i = ((instruction[0] & 0xF) << 8) | instruction[1];
                console.log('I: ', state.i);
                state.pc += 2;
                break;
            case 0xB:
                state.pc = state['v0'] + (((instruction[0] & 0xF) << 8) | instruction[1]);
                break;
            case 0xC:
                state[`v${instruction[0] & 0xF}`] = Math.floor(Math.random() * (0xFF + 1)) & instruction[1];
                state.pc += 2;
                break;
            case 0xD:
                // NEEDS TO BE FINISHED!
                const n = instruction[1] & 0xF;
                const x = state[`v${instruction[0] & 0xF}`] || 0;
                const y = state[`v${instruction[1] >> 4}`] || 0;

                state['v15'] = 0;
                for (let hline = 0; hline < n; ++hline) {
                    const membyte = state.memory[state.i + hline];
        
                    for  (let vline = 0; vline < 8; ++vline) {
                        if ((membyte & (0x80 >> vline)) !== 0) {
                            const coll = state.display.togglePixel(x + vline, y + hline);
                            if (coll) {
                                state['v15'] = 1;
                            }
                        }
                    }
                }

                state.display.repaint();
                state.pc += 2;
                break;
            case 0xE:
                state.pc += 2;
                break;
            case 0xF:
                if (instruction[1] == 0x07) {
                    state[`${instruction[0] & 0xF}`] = state.dt;
                } else if (instruction[1] == 0x0A) {
                    // TODO: Add mappings
                    process.stdin.setRawMode(true);
                    const keypress = await new Promise((resolve, reject) => {
                        process.stdin.once('data', (byteArray) => {
                            if (byteArray.length > 0 && byteArray[0] === 3) {
                                process.exit(1);
                            }
                            process.stdin.setRawMode(false);
                            resolve(byteArray[0]);
                        });
                    });
                    if (keypress === 49) {
                        state[`v${instruction[0] & 0xF}`] = 1;
                    } else {
                        state[`v${instruction[0] & 0xF}`] = keypress;
                    }
                    console.log('Keypress: ', keypress);
                } else if (instruction[1] == 0x15) {
                    state.dt = state[`v${instruction[0] & 0xF}`];
                } else if (instruction[1] == 0x18) {
                    state.st = state[`v${instruction[0] & 0xF}`];
                } else if (instruction[1] == 0x1E) {
                    state.i = state.i + state[`v${instruction[0] & 0xF}`];
                } else if (instruction[1] == 0x29) {
                    const digit = state[`v${instruction[0] & 0xF}`];
                    state.i = digit * 5;
                    console.log('Digit: ' + digit);
                    // Needs implementation 
                } else if (instruction[1] == 0x33) {
                    const xReg = state[`v${instruction[0] & 0xF}`];
                    state.memory[state.i] = parseInt(xReg / 100, 10);
                    state.memory[state.i + 1] = parseInt(xReg % 100 / 10, 0);
                    state.memory[state.i + 2] = xReg % 10;
                } else if (instruction[1] == 0x55) {
                    const x = instruction[0] & 0xF;
                    for (let i = 0; i < x + 1; i++) {
                        state.memory[state.i + i] = state[`v${i}`];
                    }
                } else if (instruction[1] == 0x65) {
                    const x = instruction[0] & 0xF;
                    for (let i = 0; i < x + 1; i++) {
                        console.log('Writing V: ' + state.memory[state.i + i]);
                        state[`v${i}`] = state.memory[state.i + i];
                    }
                } else {
                    throw new Error('Unimplemented Instruction');
                }
                state.pc += 2;
                break;
            default:
                throw new Error('Unimplemented Instruction: ' + instruction[0].toString(16));
        }
    }
}

async function run () {
    // Insert digits into memory
    insertDigits();
    // Programs expect to start at 0x200
    rom.copy(state.memory, 0x200);
    state.pc = 0x200;

    while (state.pc + 1 < state.memory.length) {
        await executeInstruction(state, [state.memory[state.pc], state.memory[state.pc + 1]]);
    }
}

run();

function insertDigits() {
    const zero = [0xF0, 0x90, 0x90, 0x90, 0xF0];
    const one = [0x20, 0x60, 0x20, 0x20, 0x70];
    const two = [0xF0, 0x10, 0xF0, 0x80, 0xF0];
    const three = [0xF0, 0x10, 0xF0, 0x10, 0xF0];
    const four = [0x90, 0x90, 0xF0, 0x10, 0x10];
    const five = [0xF0, 0x80, 0xF0, 0x10, 0xF0];
    const six = [0xF0, 0x80, 0xF0, 0x90, 0xF0];
    const seven = [0xF0, 0x10, 0x20, 0x40, 0x40];
    const eight = [0xF0, 0x90, 0xF0, 0x90, 0xF0];
    const nine = [0xF0, 0x90, 0xF0, 0x10, 0xF0];
    const aChar = [0xF0, 0x90, 0xF0, 0x90, 0x90];
    const bChar = [0xE0, 0x90, 0xE0, 0x90, 0xE0];
    const cChar = [0xF0, 0x80, 0x80, 0x80, 0xF0];
    const dChar = [0xE0, 0x90, 0x90, 0x90, 0xE0];
    const eChar = [0xF0, 0x80, 0x80, 0x80, 0xF0];
    const fChar = [0xF0, 0x80, 0xF0, 0x80, 0x80];

    const nums = [...zero, ...one, ...two, ...three, ...four, ...five, ...six, ...seven, ...eight, ...nine];
    const chars = [...aChar, ...bChar, ...cChar, ...dChar, ...eChar, ...fChar];

    const digitBuffer = Buffer.from([...nums, ...chars]);
    digitBuffer.copy(state.memory);
}

function Display() {
    const width = 64;
    const height = 32;
    let displayBuffer = Buffer.alloc(64 * 32).fill(0);

    this.togglePixel = (x, y) => {
        const idx = (y * 64) + x;
        const collision = !!displayBuffer[idx];
        displayBuffer[idx] ^= 1;

        return collision;
    }

    this.clear = () => {
        displayBuffer = displayBuffer.fill(0);
    }

    this.repaint = () => {
        console.clear();

        let output = '';
        for (let i = 0; i < displayBuffer.length; i++) {
            output += getByteChars(displayBuffer[i]);
            if (i !== 0 && (i % 64) === 0) {
                output += '\n';
            }
        }

        console.log(output);
    }

    function getByteChars(byte) {
        let out = '';
        if (byte === 1) {
            out += '*';
        } else {
            out += ' ';
        }

        return out;
    }
}
