class PeptideParser {
    constructor(str) {
        this.str = str;
        this.pos = 0;
        this.line = 0;
        this.col = 0;
    }

    static parse(str) {
        const parser = new PeptideParser(str);
        const expr = parser._p(parser.Expression);
        if (parser.peekc() !== undefined) {
            throw new Error(`${str}: Unexpected character '${parser.peekc()}' at line ${parser.line}, column ${parser.col}`);
        }
        return expr;
    }

    peekc() {
        return this.str[this.pos];
    }

    getc() {
        const ch = this.str[this.pos++];
        if (ch === '\n') {
            this.line++;
            this.col = 0;
        } else {
            this.col++;
        }
        return ch;
    }

    char(c) {
        if (this.peekc() === c) {
            this.getc();
            return true;
        }
        return false;
    }

    anychar(str) {
        if (str.includes(this.peekc())) {
            this.getc();
            return true;
        }
        return false;
    }

    peekanychar(str) {
        if (str.includes(this.peekc())) return true;
        return false;
    }

    skip() {
        while (this.anychar(' \t\n')) {}
    }

    _p(rule, ...args) {
        const startPos = this.pos;
        const startLine = this.line;
        const startCol = this.col;
        
        const result = rule.call(this, ...args);
        if (result) return result;

        // Reset position on failure
        this.pos = startPos;
        this.line = startLine;
        this.col = startCol;
        return null;
    }

    Expression() {
        let expr = this._p(this.Number);
        while (true) {
            this.skip();
            if (this.char('+')) expr = P.add(expr, this._p(this.Number));
            else if (this.char('-')) expr = P.sub(expr, this._p(this.Number));
            else if (this.char('*')) expr = P.mul(expr, this._p(this.Number));
            else if (this.char('/')) expr = P.div(expr, this._p(this.Number));
            else if (this.char('%')) expr = P.mod(expr, this._p(this.Number));
            else break;
        }
        return expr;
    }

    Number() {
        this.skip();
        let s = '';

        if (this.char('-')) s = '-';

        while (true) {
            if (!s.includes('.') && this.char('.')) s += '.';
            else if (this.peekanychar('0123456789')) s += this.getc();
            else break;
        }

        this.skip();
        const f = parseFloat(s);
        if (isNaN(f)) throw new Error(`${s}: Invalid number`);
        return P.const(f);
    }
}

// Detect environment and export accordingly
(function() {
  const nodes = { PeptideParser };
  
  // Check if we're in a module environment
  if (typeof exports !== 'undefined') {
    // Node.js or ES modules environment
    if (typeof module !== 'undefined' && module.exports) {
      // CommonJS (Node.js)
      Object.assign(module.exports, nodes);
    } else {
      // ES modules
      Object.keys(nodes).forEach(key => {
        exports[key] = nodes[key];
      });
    }
  } else if (typeof window !== 'undefined') {
    // Browser environment with script tags
    Object.keys(nodes).forEach(key => {
      window[key] = nodes[key];
    });
  }
})();

