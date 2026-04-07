const PIECES = {
  w: { king: "♔", queen: "♕", rook: "♖", bishop: "♗", knight: "♘", pawn: "♙" },
  b: { king: "♚", queen: "♛", rook: "♜", bishop: "♝", knight: "♞", pawn: "♟" },
};

const boardEl = document.getElementById("board");
const turnLabel = document.getElementById("turnLabel");
const statusLabel = document.getElementById("statusLabel");
const resetButton = document.getElementById("resetButton");

let game = createInitialGame();

function createInitialGame() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  const back = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
  for (let c = 0; c < 8; c += 1) {
    board[0][c] = { color: "b", type: back[c], moved: false };
    board[1][c] = { color: "b", type: "pawn", moved: false };
    board[6][c] = { color: "w", type: "pawn", moved: false };
    board[7][c] = { color: "w", type: back[c], moved: false };
  }

  return {
    board,
    turn: "w",
    selected: null,
    legalMoves: [],
    enPassant: null,
    result: null,
  };
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function cloneGame(state) {
  return {
    ...state,
    board: state.board.map((row) => row.map((p) => (p ? { ...p } : null))),
    selected: state.selected ? { ...state.selected } : null,
    legalMoves: state.legalMoves.map((m) => ({ ...m })),
    enPassant: state.enPassant ? { ...state.enPassant } : null,
  };
}

function getRawMoves(state, r, c, forAttack = false) {
  const piece = state.board[r][c];
  if (!piece) return [];

  const dir = piece.color === "w" ? -1 : 1;
  const enemy = piece.color === "w" ? "b" : "w";
  const moves = [];

  const pushSlide = (dr, dc) => {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      const target = state.board[nr][nc];
      if (!target) {
        moves.push({ to: [nr, nc] });
      } else {
        if (target.color !== piece.color) moves.push({ to: [nr, nc], capture: true });
        break;
      }
      nr += dr;
      nc += dc;
    }
  };

  switch (piece.type) {
    case "pawn": {
      if (!forAttack) {
        const one = r + dir;
        if (inBounds(one, c) && !state.board[one][c]) {
          moves.push({ to: [one, c] });
          const two = r + 2 * dir;
          if (!piece.moved && inBounds(two, c) && !state.board[two][c]) {
            moves.push({ to: [two, c], doubleStep: true });
          }
        }
      }

      for (const dc of [-1, 1]) {
        const nr = r + dir;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = state.board[nr][nc];
        if (target && target.color === enemy) moves.push({ to: [nr, nc], capture: true });

        if (
          !forAttack &&
          state.enPassant &&
          state.enPassant.row === nr &&
          state.enPassant.col === nc &&
          state.enPassant.byColor !== piece.color
        ) {
          moves.push({ to: [nr, nc], enPassant: true, capture: true });
        }
      }
      break;
    }
    case "knight": {
      const offsets = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];
      for (const [dr, dc] of offsets) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = state.board[nr][nc];
        if (!target || target.color !== piece.color) moves.push({ to: [nr, nc], capture: !!target });
      }
      break;
    }
    case "bishop":
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => pushSlide(dr, dc));
      break;
    case "rook":
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => pushSlide(dr, dc));
      break;
    case "queen":
      [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ].forEach(([dr, dc]) => pushSlide(dr, dc));
      break;
    case "king": {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (!dr && !dc) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = state.board[nr][nc];
          if (!target || target.color !== piece.color) moves.push({ to: [nr, nc], capture: !!target });
        }
      }

      if (!forAttack && !piece.moved && !isInCheck(state, piece.color)) {
        const row = r;

        const rookRight = state.board[row][7];
        if (
          rookRight &&
          rookRight.type === "rook" &&
          rookRight.color === piece.color &&
          !rookRight.moved &&
          !state.board[row][5] &&
          !state.board[row][6] &&
          !squareAttackedBy(state, row, 5, enemy) &&
          !squareAttackedBy(state, row, 6, enemy)
        ) {
          moves.push({ to: [row, 6], castle: "king" });
        }

        const rookLeft = state.board[row][0];
        if (
          rookLeft &&
          rookLeft.type === "rook" &&
          rookLeft.color === piece.color &&
          !rookLeft.moved &&
          !state.board[row][1] &&
          !state.board[row][2] &&
          !state.board[row][3] &&
          !squareAttackedBy(state, row, 2, enemy) &&
          !squareAttackedBy(state, row, 3, enemy)
        ) {
          moves.push({ to: [row, 2], castle: "queen" });
        }
      }
      break;
    }
    default:
      break;
  }

  return moves;
}

function findKing(state, color) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (p && p.type === "king" && p.color === color) return [r, c];
    }
  }
  return null;
}

function squareAttackedBy(state, row, col, attackerColor) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (!p || p.color !== attackerColor) continue;
      const attacks = getRawMoves(state, r, c, true);
      if (attacks.some((m) => m.to[0] === row && m.to[1] === col)) return true;
    }
  }
  return false;
}

function isInCheck(state, color) {
  const king = findKing(state, color);
  if (!king) return false;
  const enemy = color === "w" ? "b" : "w";
  return squareAttackedBy(state, king[0], king[1], enemy);
}

function applyMove(state, from, move) {
  const next = cloneGame(state);
  const [fr, fc] = from;
  const [tr, tc] = move.to;
  const piece = next.board[fr][fc];

  next.board[fr][fc] = null;

  if (move.enPassant) {
    const capRow = piece.color === "w" ? tr + 1 : tr - 1;
    next.board[capRow][tc] = null;
  }

  if (move.castle) {
    if (move.castle === "king") {
      const rook = next.board[fr][7];
      next.board[fr][7] = null;
      next.board[fr][5] = { ...rook, moved: true };
    } else {
      const rook = next.board[fr][0];
      next.board[fr][0] = null;
      next.board[fr][3] = { ...rook, moved: true };
    }
  }

  const promoted = piece.type === "pawn" && (tr === 0 || tr === 7);
  next.board[tr][tc] = {
    ...piece,
    moved: true,
    type: promoted ? "queen" : piece.type,
  };

  if (piece.type === "pawn" && move.doubleStep) {
    next.enPassant = { row: (fr + tr) / 2, col: tc, byColor: piece.color };
  } else {
    next.enPassant = null;
  }

  next.turn = state.turn === "w" ? "b" : "w";
  next.selected = null;
  next.legalMoves = [];

  return next;
}

function legalMovesFor(state, r, c) {
  const piece = state.board[r][c];
  if (!piece || piece.color !== state.turn) return [];

  const raw = getRawMoves(state, r, c, false);
  return raw.filter((m) => {
    const next = applyMove(state, [r, c], m);
    return !isInCheck(next, piece.color);
  });
}

function hasAnyLegalMove(state, color) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (p && p.color === color) {
        const candidate = { ...state, turn: color };
        if (legalMovesFor(candidate, r, c).length) return true;
      }
    }
  }
  return false;
}

function evaluateGameEnd(state) {
  const toMove = state.turn;
  const inCheck = isInCheck(state, toMove);
  const canMove = hasAnyLegalMove(state, toMove);

  if (!canMove && inCheck) {
    state.result = `${toMove === "w" ? "Black" : "White"} wins by checkmate!`;
  } else if (!canMove) {
    state.result = "Draw by stalemate.";
  } else {
    state.result = null;
  }
}

function selectSquare(r, c) {
  if (game.result) return;

  const piece = game.board[r][c];
  const selected = game.selected;

  if (!selected) {
    if (piece && piece.color === game.turn) {
      const moves = legalMovesFor(game, r, c);
      game.selected = { row: r, col: c };
      game.legalMoves = moves;
      statusLabel.textContent = moves.length
        ? "Resonance path highlighted."
        : "This fighter has no legal move.";
    }
    render();
    return;
  }

  const pickedMove = game.legalMoves.find((m) => m.to[0] === r && m.to[1] === c);
  if (pickedMove) {
    game = applyMove(game, [selected.row, selected.col], pickedMove);
    evaluateGameEnd(game);
    const enemyInCheck = isInCheck(game, game.turn);

    if (game.result) {
      statusLabel.textContent = game.result;
    } else if (enemyInCheck) {
      statusLabel.textContent = `${game.turn === "w" ? "White" : "Black"} king is in check!`;
    } else {
      statusLabel.textContent = "Move complete. Choose your next fighter.";
    }
  } else if (piece && piece.color === game.turn) {
    const moves = legalMovesFor(game, r, c);
    game.selected = { row: r, col: c };
    game.legalMoves = moves;
    statusLabel.textContent = "Target switched.";
  } else {
    game.selected = null;
    game.legalMoves = [];
    statusLabel.textContent = "Selection cleared.";
  }

  render();
}

function render() {
  boardEl.innerHTML = "";
  const checkedKing = isInCheck(game, game.turn) ? findKing(game, game.turn) : null;

  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const sq = document.createElement("button");
      sq.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
      sq.type = "button";

      if (game.selected && game.selected.row === r && game.selected.col === c) {
        sq.classList.add("selected");
      }

      const moveTag = game.legalMoves.find((m) => m.to[0] === r && m.to[1] === c);
      if (moveTag) sq.classList.add(moveTag.capture ? "capture" : "move");

      if (checkedKing && checkedKing[0] === r && checkedKing[1] === c) {
        sq.classList.add("check");
      }

      const piece = game.board[r][c];
      sq.textContent = piece ? PIECES[piece.color][piece.type] : "";
      sq.addEventListener("click", () => selectSquare(r, c));

      boardEl.appendChild(sq);
    }
  }

  const turnText = game.turn === "w" ? "White" : "Black";
  turnLabel.textContent = `Turn: ${turnText}`;
}

resetButton.addEventListener("click", () => {
  game = createInitialGame();
  statusLabel.textContent = "A new hunt begins.";
  render();
});

render();
