class PeptideParser {
    constructor(str, vars = {}) {
        this.str = str;
        this.pos = 0;
        this.line = 0;
        this.col = 0;
        this.throwing = false;
        this.vars = vars;
    }

    static parse(str, vars = {}) {
        const parser = new PeptideParser(str, vars);
        const expr = parser._p(parser.Expression);
        if (parser.peekc() !== undefined) {
            throw new Error(`${str}: unexpected character '${parser.peekc()}' at line ${parser.line}, column ${parser.col}`);
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
        
        try {
            const result = rule.call(this, ...args);
            if (result) return result;
        } catch (e) {
            if (this.throwing) throw e;
            this.throwing = true;
            throw new Error(`${e.message} at line ${this.line}, column ${this.col}`);
        }

        // Reset position on failure
        this.pos = startPos;
        this.line = startLine;
        this.col = startCol;
        return null;
    }

    Expression() {
        let expr = this._p(this.Term);
        while (true) {
            this.skip();
            if (this.char('+')) expr = P.add(expr, this._p(this.Term));
            else if (this.char('-')) expr = P.sub(expr, this._p(this.Term));
            else if (this.char('*')) expr = P.mul(expr, this._p(this.Term));
            else if (this.char('/')) expr = P.div(expr, this._p(this.Term));
            else if (this.char('%')) expr = P.mod(expr, this._p(this.Term));
            else break;
        }
        return expr;
    }

    Term() {
        return this._p(this.Number) || this._p(this.FunctionCall) || this._p(this.Variable);
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

        if (s.length === 0) return null;

        this.skip();
        const f = parseFloat(s);
        if (isNaN(f)) throw new Error(`${s}: invalid number`);
        return P.const(f);
    }

    FunctionCall() {
        const name = this._p(this.Identifier);
        if (!name) return null;
        if (!this.char('(')) return null;
        const args = this._p(this.Arguments);
        if (!this.char(')')) throw new Error(`${name}: expected ')'`);
        
        // for now we allow calling any function in Peptide - potentially want a hard-coded list later
        if (typeof P[name] === 'function') {
            if (P[name].length !== args.length) {
                throw new Error(`${name}: expected ${P[name].length} arguments, got ${args.length}`);
            }
            return P[name](...args);
        } else {
            throw new Error(`Unknown function: ${name}`);
        }
    }

    Arguments() {
        const args = [];
        while (true) {
            this.skip();
            if (this.char(')')) break;
            args.push(this._p(this.Expression));
            if (this.char(',')) continue;
            if (this.peekc() == ')') break;
            throw new Error(`expected ',' or ')'`);
        }
        return args;
    }

    Variable() {
        const name = this._p(this.Identifier);
        if (!name) return null;
        const type = this.vars[name];
        if (!type) return P.var(name);
        if (type === 'float') return P.var(name);
        if (type === 'vec3') {
            if (!this.char('.')) return P.vvar(name);
            if (this.char('x')) return P.vecX(P.vvar(name));
            if (this.char('y')) return P.vecY(P.vvar(name));
            if (this.char('z')) return P.vecZ(P.vvar(name));
            throw new Error(`${name}: expected x/y/z after dot`);
        }
        throw new Error(`${name}: unknown variable type: ${type}`);
    }

    Identifier() {
        this.skip();
        let s = '';
        while (this.peekanychar('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_')) s += this.getc();
        if (s[0] >= '0' && s[0] <= '9') throw new Error(`${s}: invalid identifier`);
        this.skip();
        return s;
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

