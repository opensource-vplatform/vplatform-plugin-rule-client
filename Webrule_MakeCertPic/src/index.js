
/**
 *	生成验证码
 */
 vds.import("vds.window.*","vds.string.*","vds.rpc.*","vds.message.*","vds.environment.*","vds.widget.*")
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			if (!inParamsObj) {//建议兼容
				inParamsObj = "";
			}
			var widgetId = inParamsObj["picCode"];
			var buildTargetType = "fileID" == inParamsObj["buildTargetType"] ? "fileID" : "imageControl";
			var fileIDReceiveTargetType = inParamsObj["fileIDReceiveTargetType"] ? inParamsObj["fileIDReceiveTargetType"] : null;
			var valueTarget = inParamsObj["fileIDReceiveTarget"];
			var moduleId = vds.window.getCode();
			var iden = vds.string.uuid();
			document.cookie = "v_platform_make_code_iden=" + iden;
			if ("fileID" == buildTargetType) {
				var success = function (datas) {
					var methodContext = ruleContext.getMethodContext();
					switch (fileIDReceiveTargetType) {
						case "ruleSetInput":
							methodContext.setInput(valueTarget, iden);
							break;
						case "ruleSetVar":
							methodContext.setVariable(valueTarget, iden);
							break;
						case "ruleSetOutput":
							methodContext.setOutput(valueTarget, iden);
							break;
					}
					resolve();
				}
				var promise = vds.rpc.callCommand("FileCertImage", [], {
					"isAsync": false,
					"isRuleSetCode": false
				});
				promise.then(function (datas) {
					if (datas && datas.success) {
						success();
					} else {
						var promise = vds.message.error("生成验证码失败" + (datas.msg ? ", 错误信息：" + datas.msg : ""));
						promise.then(resolve).catch(reject);
					}
				}).catch(reject);
			} else {
				//xx参数防止图片组件接受相同地址时不刷新问题
				var url = vds.environment.getContextPath() + 'module-operation!executeOperation?moduleId=' + moduleId + '&operation=FileCertImage&xx=' + vds.string.uuid();
				vds.widget.execute(widgetId, 'setImageUrl', [url]);
				resolve();
			}
		} catch (err) {
			reject(err);
		}
	});
}
export {
	main
}