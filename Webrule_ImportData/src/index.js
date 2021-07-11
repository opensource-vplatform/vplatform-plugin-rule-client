/**
 * 文件导入<code>
{
	"dataName": "sxzTestProject",
	"dataType": "Table",
	"dgcolumn": [{
		"chineseName": "amount",
		"fieldName": "amount",
		"source": "Excel",
		"value": ""
	},
	{
		"chineseName": "deptName",
		"fieldName": "deptName",
		"source": "Excel",
		"value": ""
	},
	{
		"chineseName": "money",
		"fieldName": "money",
		"source": "Excel",
		"value": ""
	}],
	"fileType": "Excel",
	"innerCode": "",
	"startRow": "3",
	"uploadControlId":"" //上传控件的ＩＤ
	"importNodeId":"表达式" //导入目标节点ID
	"treeStruct": [{
		"tableID": "",
		"tableName": "",
		"type": "1",
		"pidField": "",
		"treeCodeField": "",
		"orderField": "",
		"isLeafField": ""
	}]
    
}
 * </code>
 */
//vds.import("vds.");
/**
 * 规则入口
 */
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamObj = ruleContext.getVplatformInput();
			if (!inParamObj) {//建议兼容
				inParamObj = "";
			}
			var ruleConfig = ruleContext.getRuleCfg();//????
			var instanceCode = ruleConfig.instanceCode;//???
			var dataSourceName = inParamObj.dataName;
			var dataType = inParamObj.dataType; // 为Table或Tree
			var uploadControlId = inParamObj.uploadControlId;// 上传控件id
			var importNodeId = inParamObj.importNodeId;// 导入目标树节点id
			var treeStruct = inParamObj.treeStruct;// 树结构配置

			if (uploadControlId == null || uploadControlId == "") {
				var promise = vds.message.error("规则配置中的上传控件id不能为空");
				promise.then(resolve);
				return false;
			}
			var comp = vds.widget.getProperty(uploadControlId, "getComponent")

			if (!comp) {
				var promise = vds.message.error('找不到执行导入的文件控件');
				promise.then(resolve);
				return false;
			}

			dataType = dataType.toLowerCase();

			// 得到导入的目标节点id值
			var selectId = '';
			if (dataType == "tree") {
				if (treeStruct == null || treeStruct.length == 0) {
					var promise = vds.message.error("规则配置中没有树结构信息");
					promise.then(resolve);
					return false;
				}
				if (treeStruct[0].type != "1" && treeStruct[0].type != "2") {
					var promise = vds.message.error("规则配置中树类型只能为层级码树或左右树");
					promise.then(resolve);
					return false;
				}
				if (importNodeId != null && importNodeId != "") {
					var selectId = vds.expression.execute(importNodeId, {
						"ruleContext": context
					});
				}

			}
			// 得到字段值包括表达式 Express、实体字段 Entity、系统变量 System、组件变量 Component
			var varMap = {};
			for (var i = 0; i < inParamObj.dgcolumn.length; i++) {
				var source = inParamObj.dgcolumn[i].source;
				var fieldName = inParamObj.dgcolumn[i].fieldName;
				var value = inParamObj.dgcolumn[i].value;
				if (source === 'Entity') {
					dataSourceName = value.substring(0, value.indexOf("."));
					var datasource = vds.ds.lookup(dataSourceName);
					var currentRow = datasource.getCurrentRecord();
					var datasource = vds.ds.lookup(changeDsArr[changeIndex]);
					var db = datasourceclearRemoveDatas();

					if (currentRow != null) {
						varMap[fieldName] = currentRow.get(value);
					} else {
						varMap[fieldName] = null;
					}
				} else if (source === 'System') {
					// 如果是系统变量
					varMap[fieldName] = vds.component.getVariant({ "code": value });
				} else if (source === 'Component') {
					// 如果是组件变量
					varMap[fieldName] = vds.window.getInput({ "code": value });
				} else if (source === 'Express' || source === 'expression') {
					// 如果是表达式
					varMap[fieldName] = vds.expression.execute(value, {
						"ruleContext": ruleContext
					});
				}
			}

			var actionType = "importTable";
			var routeRuntime = ruleContext.getRouteContext();
			var transactionId = routeRuntime.getTransactionId();//???
			// actionType="importEntity";
			var option = {
				ruleInstId: instanceCode,
				selectId: selectId,
				action: actionType,
				varMap: varMap,
				ruleConfig: vds.string.toJson(inParamObj),
				instance: transactionId
			};
			var callback = function (arg1, arg2) {
				try {
					vds.log.log("结束发送时间：" + new Date().toLocaleTimeString());
					if (arg2) {
						if (arg2.success) {
							resolve();
						} else {
							reject(arg2);
						}
					} else {
						vds.log.error("上传控件回调参数不正确，请处理！");
					}
				} catch (err) {
					reject(err);
				}
			}
			callback = ruleContext.genAsynCallback(callback);
			var start = new Date();
			vds.log.log("开始发送时间：" + start.toLocaleTimeString());
			vds.widget.execute(uploadControlId, "importData", [option, callback])
		} catch (err) {
			reject(err);
		}
	});
}
export {
	main
}