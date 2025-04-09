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

    skip() {
        while (this.peekc() === ' ' || this.peekc() === '\t' || this.peekc() === '\n') this.getc();
    }

    _p(rule) {
        const startPos = this.pos;
        const startLine = this.line;
        const startCol = this.col;
        
        const result = rule.call(this);
        if (result) return result;

        // Reset position on failure
        this.pos = startPos;
        this.line = startLine;
        this.col = startCol;
        return null;
    }

    Expression() {
        this.skip();
        const expr = this._p(this.Number);
        this.skip();
        return expr;
    }

    Number() {
        this.skip();
        let s = '';
        while (true) {
            const ch = this.peekc();
            if (ch == '-') {
                if (s == '') s = this.getc();
                else break;
            } else if (ch == '.') {
                if (s.includes('.')) break;
                s += this.getc();
            } else if (ch >= '0' && ch <= '9') {
                s += this.getc();
            } else {
                break;
            }
        }
        this.skip();
        return P.const(parseFloat(s));
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

