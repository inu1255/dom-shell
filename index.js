(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.Shell = factory();
    }
}(this, function() {
    function Shell(config) {
        this.config = config = Object.assign({
            history: null,
            showOutput: false,
            prefixWidth: 20,
            message: Shell.message
        }, config);
        this.refs = {};
        this.completionList = [];
        this.completeSelect;
        this.cmds = {};
        if (config.showOutput) {
            this.showOutput();
        }
        this.message = config.message;
        if (!config.history) {
            this.history = new Shell.LocalHistory();
            this.use("history", this.history);
        } else {
            this.history = config.history;
        }
        this.init(config);
    }
    Shell.prototype.isFocus = function() {
        var s = window.getSelection();
        return s.extentNode && (s.extentNode.parentNode == this.refs.input || s.extentNode == this.refs.input);
    };
    Shell.prototype.focus = function() {
        this.refs.input.focus();
        return this;
    };
    Shell.prototype.show = function() {
        this.refs.root.style.display = "block";
        this.focus();
        if (this.config.caret) {
            var node = this.refs.input.childNodes[0];
            var s = window.getSelection();
            s.setBaseAndExtent(node, this.config.caret, node, this.config.caret);
        }
        return this;
    };
    Shell.prototype.hide = function() {
        this.saveCaret();
        this.refs.root.style.display = "none";
        return this;
    };
    Shell.prototype.init = function(config) {
        var container = config.el;
        var dom = document.createElement("div");
        dom.className = "shell-container";
        if (!Shell.style) {
            Shell.style = ".shell-container{position:fixed;bottom:0;left:0;right:0;font-family:Consolas,Monaco,monospace;font-size:14px;}.shell-input{position:relative;background:rgba(0,0,0,.1);padding:3px 0;}.shell-input-prefix{margin:0 5px;display:inline-block;width:10px;}.shell-input-menu{margin:0 5px;width:10px;float:right;cursor:pointer;}.shell-input-line{display:inline-block;outline:0;min-width:10px;}.shell-output{height:50vh;overflow-y:scroll;background:#f0f9f0;margin:0;padding:5px 15px;}.shell-container li{list-style-type:none;}.shell-complete{position:absolute;bottom:100%;display:none;}.shell-complete>*{background:#eee;border:1px solid #ccc;padding:5px;width:240px;margin:0;display:inline-block;transition:all 100ms;}.shell-complete-items li.active{background:rgba(0,0,0,.15);}.shell-complete-desc{position:absolute;left:100%;top:0;white-space:pre-wrap;}";
            var style = document.createElement("style");
            style.innerHTML = Shell.style;
            document.head.appendChild(style);
        }
        dom.innerHTML = '<div class="shell-container"><div class="shell-complete"><ul class="shell-complete-items"></ul><div class="shell-complete-desc"></div></div><div class="shell-input"><span class="shell-input-prefix">></span><div contenteditable="true" class="shell-input-line"></div><span class="shell-input-menu">+</span></div><ul class="shell-output" style="display: none"></ul></div>';
        container = container || document.body;
        container.appendChild(dom);
        this.initDom(dom, this.refs);
        this.initInput(dom, this.refs);
        this.initOutput(dom, this.refs);
        this.initComplete(dom, this.refs);
        return this;
    };
    Shell.prototype.saveCaret = function() {
        this.config.caret = window.getSelection().extentOffset;
        return this;
    };
    Shell.prototype.initDom = function(dom, refs) {
        this.refs.root = dom;
        document.addEventListener("keydown", (e) => {
            if (e.altKey && e.keyCode == 220) {
                if (this.isFocus()) {
                    this.hide();
                } else {
                    this.show();
                }
                e.preventDefault();
            }
        });
        document.addEventListener("mousedown", (e) => {
            for (var i = 0; i < e.path.length; i++) {
                if (e.path[i] == dom) {
                    break;
                }
            }
            if (i >= e.path.length) {
                this.saveCaret();
            }
        });
    };
    Shell.prototype.initInput = function(dom, refs) {
        var input = dom.querySelector(".shell-input");
        input.addEventListener("click", function() {
            refs.input.focus();
        });
        refs.input = dom.querySelector(".shell-input-line");
        refs.input.addEventListener("keydown", (e) => {
            switch (e.keyCode) {
                case 85:
                    if (e.ctrlKey) { // ctrl + u
                        this.refs.input.innerText = "";
                        break;
                    }
                    return;
                case 38: // ArrayUp
                    if (refs.complete.style.display == "block") {
                        this.moveComplete(-1);
                    } else {
                        this.moveHistory(-1);
                    }
                    break;
                case 40: // ArrayDown
                    if (refs.complete.style.display == "block") {
                        this.moveComplete(1);
                    } else {
                        this.moveHistory(1);
                    }
                    break;
                case 27: // Esc
                    refs.complete.style.display = "none";
                    break;
                case 9: // Tab
                    if (refs.complete.style.display == "block") {
                        this.complete();
                    } else {
                        this.updateComplete(true);
                    }
                    break;
                case 13: // Enter
                    if (refs.complete.style.display == "block") {
                        this.complete();
                    } else {
                        this.run(refs.input.innerText);
                    }
                    break;
                default:
                    return;
            }
            e.preventDefault();
        });
        refs.input.addEventListener("keyup", (e) => {
            switch (e.keyCode) {
                case 38:
                case 40:
                case 27:
                case 9:
                case 13:
                    break;
                default:
                    this.updateComplete();
            }
        });
    };
    Shell.prototype.initOutput = function(dom, refs) {
        refs.menu = dom.querySelector(".shell-input-menu");
        refs.output = dom.querySelector(".shell-output");
        refs.menu.addEventListener("click", () => {
            if (refs.output.style.display == "none") {
                this.showOutput();
            } else {
                this.hideOutput();
            }
        });
        this.use("output", {
            hide: this.hideOutput.bind(this),
            show: this.showOutput.bind(this)
        });
    };
    Shell.prototype.initComplete = function(dom, refs) {
        refs.complete = dom.querySelector(".shell-complete");
        refs.items = dom.querySelector(".shell-complete-items");
        refs.desc = dom.querySelector(".shell-complete-desc");
    };
    Shell.prototype.hideOutput = function() {
        this.refs.output.style.display = "none";
        this.refs.menu.innerText = "+";
        return this;
    };
    Shell.prototype.showOutput = function() {
        this.refs.output.style.display = "";
        this.refs.menu.innerText = "-";
        return this;
    };
    Shell.prototype.output = function(ss) {
        var output = this.refs.output;
        ss.split("\n").forEach(function(item) {
            var li = document.createElement("li");
            li.innerText = item;
            output.appendChild(li);
        });
        return this;
    };
    Shell.prototype.outputClear = function(ss) {
        this.refs.output.innerHTML = "";
        return this;
    };
    Shell.prototype.run = function(tokens) {
        tokens = tokens.trim();
        if (tokens && tokens.length) {
            this.history.push(tokens);
            tokens = tokens.split(/\s+/);
            this.refs.input.innerText = "";
            var cmd = this.cmds[tokens[0]];
            if (cmd) {
                var fn = cmd[tokens[1] || "index"];
                if (typeof fn === "function") {
                    this.outputClear();
                    try {
                        fn.apply(cmd, tokens.slice(2));
                    } catch (error) {
                        this.output("执行命令出错: " + tokens + "\n" + error);
                        console.debug("执行命令出错:", tokens, error);
                    }
                    return this;
                }
            }
            this.output("命令不存在: " + tokens);
        }
        return this;
    };
    Shell.prototype.moveComplete = function(n) {
        var index = this.completionList.indexOf(this.completeSelect);
        if (index < 0) index = 0;
        for (var i = 0; i < 100; i++) {
            index = (index + n + this.completionList.length) % this.completionList.length;
            this.completeSelect = this.completionList[index];
            if (this.completeSelect.li.style.display == "block") {
                break;
            }
        }
        this.updateActiveComplete();
        return this;
    };
    Shell.prototype.moveHistory = function(n) {
        var s = window.getSelection();
        var prefix = this.refs.input.innerText.slice(0, s.extentOffset);
        this.history.go(n, prefix, (text) => {
            var node = s.extentNode;
            var offset = s.extentOffset;
            this.refs.input.innerText = text;
            s.setBaseAndExtent(node, offset, node, offset);
        });
        return this;
    };
    Shell.prototype.provideCompletes = function(data) {
        var data = data || this.getData();
        if (data.index != this.completionList.index) {
            this.completeClear();
            this.completionList.index = data.index;
            var appendComplete = this.appendComplete.bind(this);
            if (data.index > 0) {
                var v = this.cmds[data.tokens[0]];
                if (v && typeof v.provideCompletionItems === "function") {
                    try {
                        appendComplete(v.provideCompletionItems(k, data, appendComplete));
                    } catch (error) {
                        console.debug("Shell获取补全失败cmd:", data.tokens[0], "data:", data, error);
                    }
                }
            } else {
                for (var k in this.cmds) {
                    var v = this.cmds[k];
                    if (typeof v.provideCompletionItems === "function") {
                        try {
                            appendComplete(v.provideCompletionItems(k, data, appendComplete));
                        } catch (error) {
                            console.debug("Shell获取补全失败cmd:", k, "data:", data, error);
                        }
                    }
                }
            }
        }
        return this;
    };
    Shell.prototype.getData = function() {
        var data = {};
        // 当前命令行内容
        data.text = this.refs.input.innerText;
        var s = window.getSelection();
        if (s.extentNode) {
            // 当前光标位置
            data.caret = s.extentOffset;
            var s = window.getSelection();
            var begin = s.extentOffset - 1;
            for (; begin >= 0; begin--) {
                if (/\s/.test(data.text.charAt(begin)))
                    break;
            }
            var end = s.extentOffset - 1;
            for (; end < data.text.length; end++) {
                if (/\s/.test(data.text.charAt(end)))
                    break;
            }
            // 当前光标前的单词数组
            data.tokens = data.text.slice(0, data.caret).trim().split(/\s+/);
            // 当前需要补全的位置
            data.index = data.tokens.length;
            // 当前需要补全的前缀
            if (end > begin) {
                data.index--;
                    // 当前待补全文字范围
                    data.begin = begin + 1;
                data.end = end;
            }
            data.prefix = data.tokens[data.index];
        }
        return data;
    };
    Shell.prototype.complete = function(item) {
        item = item || this.completeSelect || this.completionList[0];
        if (item) {
            var data = this.getData();
            if (data.end) {
                var s = window.getSelection();
                s.setBaseAndExtent(s.extentNode, data.begin, s.extentNode, data.end);
            }
            document.execCommand("insertHTML", false, item.value);
            this.refs.complete.style.display = "none";
        }
        return this;
    };
    Shell.prototype.updateActiveComplete = function() {
        var aim = this.completeSelect || this.completionList[0];
        this.completionList.forEach((item) => {
            if (item == aim) {
                item.li.className = "active";
                this.setDesc(item.desc);
            } else {
                item.li.className = "";
            }
        });
        return this;
    };
    Shell.prototype.updateComplete = function(force) {
        // 光标在命令行中
        var s = window.getSelection();
        if (this.isFocus() && s.type == "Caret") {
            var percent = this.refs.input.innerText.length > 0 ? s.extentOffset / this.refs.input.innerText.length : 0;
            this.refs.complete.style.left = this.config.prefixWidth + this.refs.input.clientWidth * percent + "px";
            var data = this.getData();
            var prefix = data.prefix || "";
            if (prefix || force) {
                this.provideCompletes(data);
                var aim = this.completeSelect || this.completionList[0];
                var show = false;
                this.completionList.forEach((item) => {
                    if (prefix != item.label && item.label.indexOf(prefix) >= 0) {
                        item.li.style.display = "block";
                        show = true;
                    } else {
                        item.li.style.display = "none";
                    }
                });
                if (aim && aim.li.style.display == "none") {
                    this.moveComplete(1);
                } else {
                    this.updateActiveComplete();
                }
                if (show) {
                    this.refs.complete.style.display = "block";
                    return this;
                }
            }
        }
        this.refs.complete.style.display = "none";
        return this;
        this.adjustComplete();
    };
    Shell.prototype.setDesc = function(desc) {
        if (desc) {
            this.refs.desc.innerHTML = desc;
            this.refs.desc.style.display = "block";
        } else {
            this.refs.desc.style.display = "none";
        }
    };
    Shell.prototype.appendComplete = function(items) {
        if (items && typeof items.forEach === "function") {
            var completes = this.completionList;
            var completeItems = this.refs.items;
            items.forEach(function(item) {
                if (typeof item === "string") item = { label: item, value: item };
                item.label = item.label || item.value;
                item.value = item.value || item.label;
                item.li = document.createElement("li");
                item.li.innerText = item.label;
                completeItems.appendChild(item.li);
                completes.push(item);
            });
        }
        return this;
    };
    Shell.prototype.completeClear = function(items) {
        this.refs.items.innerHTML = "";
        this.completeSelect = 0;
        this.completionList = [];
        return this;
    };
    Shell.prototype.use = function(key, cmd) {
        if (cmd) {
            if (cmd.constructor == Object) {
                cmd.__proto__ = new Shell.Command();
            }
            cmd.shell = this;
            this.cmds[key] = cmd;
        }
        return this;
    };
    Shell.Command = function() {
        this.shell = null;
        ignores = {
            "index": true,
            "provideCompletionItems": true,
            "provideParams": true
        };
        ignores.push = function(key) {
            ignores[key] = true;
        };
        this.ignores = ignores;
    };
    Shell.Command.prototype.provideCompletionItems = function(key, data, add) {
        if (data.index == 0)
            return [key];
        if (data.index == 1) {
            var items = [];
            for (var k in this) {
                var v = this[k];
                if (this.ignores[k]) {
                    continue;
                }
                if (typeof v === "function") {
                    items.push(k);
                }
            }
            return items;
        }
        return this.provideParams();
    };
    Shell.Command.prototype.provideParams = function(data) {
        return [];
    };
    Shell.LocalHistory = function(key) {
        this.key = key || "$shell.history";
        this.history = JSON.parse(localStorage.getItem(this.key) || "[]");
        this.ignores.push("go", "push");
    };
    Shell.LocalHistory.prototype = new Shell.Command();
    Shell.LocalHistory.prototype.push = function(tokens) {
        if (tokens && tokens != this.history[this.history.length - 1]) {
            this.history.push(tokens);
            this.idx = undefined;
        }
        localStorage.setItem(this.key, JSON.stringify(this.history));
    };
    Shell.LocalHistory.prototype.go = function(n, prefix, cb) {
        var idx = this.idx;
        if (idx === undefined) idx = this.history.length;
        for (var i = 0; i < 100; i++) {
            idx = (idx + n + this.history.length + 1) % (this.history.length + 1);
            var text = this.history[idx] || "";
            if (text.startsWith(prefix)) {
                this.idx = idx;
                if (typeof cb === "function") {
                    cb(text);
                }
                break;
            }
        }
    };
    Shell.LocalHistory.prototype.clear = function() {
        this.history = [];
        this.idx = undefined;
    };
    Shell.LocalHistory.prototype.index = function() {
        this.list();
    };
    Shell.LocalHistory.prototype.list = function() {
        for (var i = 0; i < this.history.length; i++) {
            this.shell.output(this.history[i]);
        }
    };
    Shell.message = (function() {
        var inst = {};
        var log = function(msg, time, bg, color, border) {
            color = color || "#000";
            border = border || bg || "#D3D4D6";
            bg = bg || "#fff";
            time = time || 1500;
            if (!inst.container) {
                var div = document.createElement("div");
                div.style.position = "fixed";
                div.style.top = "40px";
                div.style.left = 0;
                div.style.right = 0;
                div.style.textAlign = "center";
                document.body.appendChild(div);
                inst.container = div;
            }
            var span = document.createElement("span");
            span.style.display = "inline-block";
            span.innerText = msg;
            span.style.background = bg;
            span.style.color = color;
            span.style.transition = "all 500ms";
            span.style.padding = "3px 9px";
            span.style.border = "1px solid " + border;
            span.style.borderRadius = "5px";
            span.style.maxWidth = "33%";
            span.style.wordWrap = "break-word";
            span.style.opacity = 0;
            inst.container.appendChild(span);
            setTimeout(function() {
                span.style.opacity = 1;
            });
            setTimeout(function() {
                span.style.opacity = 0;
            }, time - 500);
            setTimeout(function() {
                inst.container.removeChild(span);
            }, time);
        };
        inst.log = log;
        inst.primary = function(msg, time) {
            inst.log(msg, time, "#46A0FC", "#fff");
        };
        inst.success = function(msg, time) {
            inst.log(msg, time, "#6AC044", "#fff");
        };
        inst.info = function(msg, time) {
            inst.log(msg, time, "#909399", "#fff");
        };
        inst.warning = function(msg, time) {
            inst.log(msg, time, "#E4A147", "#fff");
        };
        inst.error = function(msg, time) {
            inst.log(msg, time, "#F36D6F", "#fff");
        };
        return inst;
    })();
    return Shell;
}));