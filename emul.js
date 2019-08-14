const fs = require('fs');

const rom = fs.readFileSync(__dirname + '/app.rom');
const state = {
    i: 0,
    pc: 0,
    sp: 0,
    stack: Buffer.alloc(32),
    memory: Buffer.alloc(4095),
    display: new Display(),
};
const keysDown = {};

// Sets up general purpose registers
for (let i = 0; i < 15; i++) {
    state[`v${i}`] = 0;
}

// const stdin = process.openStdin(); 

// stdin.on('keypress', (chunk, key) => {
//     keysDown[key.name] = true;
// });

// stdin.on('keyup', (chunk, key) => {
//     keysDown[key.name] = false;
// });

function executeInstruction(state, instruction) {
    console.log(instruction);
    if (instruction[0] + instruction[1] == 0x00E0) {
        // CLR: Clear Screen
        console.log('Clear Screen!');
    } else if (instruction[0] + instruction[1] == 0x00EE) {
        // RET: Return from subroutine
        state.pc = state.stack[state.sp];
        state.sp--;
    } else if (instruction[0] >> 4 == 0x00) {
        // SYS addr
        // Jump to a machine code routine at nnn. Meant to be ignored
        // console.warn('This instruction is being ignored...');
    } else {
        switch (instruction[0] >> 4) {
            case 0x1:
                // JMP
                state.pc = ((instruction[0] & 0xF) << 8) | instruction[1];
                console.log('PC: ', state.pc);
                break;
            case 0x2:
                // CALL
                state.sp++;
                state.stack[state.sp] = state.pc;
                break;
            case 0x3:
                // SE Vx, byte
                // Compares register Vx to kk, if equal, increment program counter by 2
                if (state[`v${instruction[0] & 0xF}`] == instruction[1]) {
                    state.pc += 2;
                }
                break;
            case 0x4:
                // SNE Vx, byte
                // Compares register Vx to kk, if not equal, increment program counter by 2
                if (state[`v${instruction[0] & 0xF}`] != instruction[1]) {
                    state.pc += 2;
                }
                break;
            case 0x5:
                // SE Vx, Vy
                // Compares register Vx to Vy, if equal, increment program counter by 2
                if (state[`v${instruction[0] & 0xF}`] != state[`v${instruction[0] >> 4}`]) {
                    state.pc += 2;
                }
                break;
            case 0x6:
                // Set Vx = kk
                // The interpreter puts the value kk into register Vx
                state[`v${instruction[0] & 0xF}`] = instruction[1];
                break;
            case 0x7:
                // Set Vx = Vx + kk.
                // Adds the value kk to the value of register Vx, then stores the result in Vx
                state[`v${instruction[0] & 0xF}`] += instruction[1];
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

                    state[`v${instruction[0] & 0xF}`] = xReg / 2;
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
                }
                break;
            case 0x9:
                // Skip next instruction if Vx != Vy.
                if (state[`v${instruction[0] & 0xF}`] != state[`v$${instruction[1] >> 4}`]) {
                    state.pc += 2;
                }
                break;
            case 0xA:
                state.i = (instruction[0] & 0xF) + instruction[1];
                break;
            case 0xB:
                state.pc = state['v0'] + (instruction[0] & 0xF) + instruction[1];
                break;
            case 0xC:
                state[`v${instruction[0] & 0xF}`] = ((Math.random() * 255) - 1) & instruction[1];
                break;
            case 0xD:
                // NEEDS TO BE FINISHED!
                const n = instruction[1] & 0xF;
                const x = state[`v${instruction[0] & 0xF}`];
                const y = state[`v$${instruction[1] >> 4}`];
                const index = state.i;
                const bytesToDisplay = [];

                for (let i = 0; i < n; i++) {
                    bytesToDisplay.push(state.memory[index + i]);
                }

                console.log(bytesToDisplay);

                // state.display.write(x, y, bytesToDisplay);

                break;
            case 0xE:

                break;
            case 0xF:
                if (instruction[1] == 0x33) {
                    const xReg = state[`v${instruction[0] & 0xF}`];
                    console.log('xReg: ', xReg);
                    state.memory[state.i] = xReg.toString()[0] || 0;
                    state.memory[state.i + 1] = xReg.toString()[1] || 0;
                    state.memory[state.i + 2] = xReg.toString()[2] || 0;
                } else if ((instruction[0] & 0xF)) {
                } else {
                    throw new Error('Unimplemented Instruction');
                }
                break;
            default:
                throw new Error('Unimplemented Instruction');
        }
    }
}

// Programs expect to start at 0x200
rom.copy(state.memory, 0x200);

while (state.pc + 1 < state.memory.length) {
    executeInstruction(state, [state.memory[state.pc], state.memory[state.pc + 1]]);
    state.pc += 2;
}

function Display() {
    const width = 64;
    const height = 31;
    const displayBuffer = Buffer.alloc(64 * 32);

    this.write = (x, y, buffer) => {
        for (let i = 0; i < buffer.length; i++) {
            const startAddr = (y * width) + x;
            displayBuffer[startAddr + i] = displayBuffer[startAddr + i] ^ buffer[i];
            y++;
        }

        drawToConsole();
    };

    function drawToConsole() {
        for (let y = 0; y < 31; y++) {
            for (let x = 0; x < 8; x++) {
                console.log(getByteChars(displayBuffer[y]));
            }

            console.log('\n');
        }
    }

    function getByteChars(byte) {
        let out = '';
        const checks = [0b0001, 0b0010, 0b0100, 0b1000];
        for (let i = 0; i < checks.length; i++) {
            if ((byte & checks[i]) != 0) {
                out += '*';
            } else {
                out += ' ';
            }
        }

        return out;
    }
}
