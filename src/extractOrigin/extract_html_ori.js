const {
    JSDOM
} = require("jsdom");
import {
    log,
    LOG_TYPE,
    trim
}
from '../util/index';

import ExtractJS from './extract_js_ori';
import Extract from './extract';

/**
 * HTML文件解析类
 */
class ExtractHTML extends Extract {
    constructor(option) {
        super(option);

        this.extractJS = new ExtractJS({});
        this.jsHandleList = [];
    }

    transNode(html) {
        this.getHeaderTag(html);;
        // todo by xc 修改为正则匹配script标签
        return new Promise((resolve, reject) => {
            try {
                let dom = new JSDOM(html);
                let document = dom.window.document;
                resolve(document);
            } catch (err) {
                reject(err);
            }
        });
    }

    getHeaderTag(html) {
        this.hasHeader = !!html.match(/\<head\>/g);
        this.hasBody = !!html.match(/\<body([^>]*)\>/g);
        this.footerTag = '\t\n<\html>';
    }

    // 扫描节点，提取字段
    scanNode(document) {
        // 遍历各节点
        this.listNode(document.documentElement);

        return this.nextJsTask().then(() => {
            let outHtml = document.documentElement.innerHTML;

            if (!this.hasHeader) {
                outHtml = outHtml.replace(/\<head\>[\s\S]*\<\/head\>/g, '');
            }
            if (!this.hasBody) {
                outHtml = outHtml.replace(/(\<body([^>]*)\>)|(\<\/body\>)/g, '');
            }
            outHtml = outHtml.replace(/^\s*|\s*$/g, '');
            outHtml = document.doctype ? '<!doctype html>\t\n<html>\t\n' + outHtml + '\t\n</html>' : outHtml;

            return outHtml;
        });
    }

    handleJsTask(child) {
        return this.extractJS.transNode(child.nodeValue)
            .then(AST => {
                return this.extractJS.scanNode(AST);
            })
            .then((fileData) => {
                // 写入文件
                child.nodeValue = fileData;
                return this.nextJsTask();
            })
            .catch(error => {
                console.log(error);
                log(`内联JS处理出错- ${error}`, LOG_TYPE.error);
                return this.nextJsTask();
            });
    }

    nextJsTask() {
        // 当一个文件执行完成，立即执行下一个指令
        if (this.jsHandleList.length > 0) {
            return this.handleJsTask(this.jsHandleList.shift());
        }
        return Promise.resolve('done');
    }

    addJsTask(handle) {
        this.jsHandleList.push(handle);
    }

    listNode(element) {
        if (!element) {
            return;
        }

        let firstChild = element.firstChild,
            nextSibling = element.nextSibling,
            nodeType = element.nodeType,
            nodeName = element.nodeName.toLowerCase();
        //处理html节点
        // nodeType: 1-元素 2-属性 3-文本内容 8-代表注释
        if (nodeType === 1 && nodeName == 'script') {
            if (firstChild && firstChild.nodeValue && trim(firstChild.nodeValue)) {
                this.addJsTask(firstChild);
            }
        } else {
            // 处理子节点
            if (firstChild) {
                this.listNode(firstChild);
            }
        }

        // 处理兄弟节点
        if (nextSibling) {
            this.listNode(nextSibling);
        }
    }
}

export default ExtractHTML;