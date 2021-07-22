/**
 *	进度条显示/隐藏
 */
vds.import("vds.environment.*","vds.expression.*","vds.progress.*")
/**
 * 规则入口
 */
var main = function (ruleContext) {
    return new Promise(function (resolve, reject) {
        try {
            var inParamsObj = ruleContext.getVplatformInput();
            if(!inParamsObj){//奇怪的配置
                inParamsObj = {};
            }
            var display = inParamsObj["display"];
            var msgnote = inParamsObj["msgnote"];
            var isGlobal = (inParamsObj["displaytype"] + "").toLowerCase() === "current" ? false : true;
            if (display) {
                var msg = null;
                // 处理手机端加载提示信息
                if (vds.environment.isMobileWindow())
                    msg = "正在加载...";
                if (msgnote != null && msgnote != "") {
                    msg = vds.expression.execute(msgnote, {
                        "ruleContext": ruleContext
                    });
                }
                if (null == msg || "" == msg) {
                    msg = "数据加载中，请稍后...";
                }
                vds.progress.show(msg, {
                    "ruleContext": ruleContext,
                    "global": isGlobal
                });
            } else {
                vds.progress.hide({
                    "global": isGlobal
                });
            }
            var callbackFunc = function () {
                resolve();
            }
            setTimeout(callbackFunc, 100);
        } catch (err) {
            reject(err);
        }
    });
}
export {
    main
}