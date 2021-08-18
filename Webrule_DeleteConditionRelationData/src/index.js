/**
 * 删除数据库中的记录
 */

vds.import("vds.ds.*", "vds.log.*", "vds.object.*", "vds.rpc.*", "vds.string.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();
			var dtChileMaps = inParamsObj["dtChileMaps"];
			var treeStructs = inParamsObj["treeStruct"];

			var treeStruct = null;
			if (!vds.object.isArray(treeStructs) || (vds.object.isArray(treeStructs) && treeStructs.length < 1)) {
				treeStruct = null;
			} else {
				treeStruct = treeStructs[0];
			}

			// 组装后台删除数据条件
			var isDelete = false; // 后台是否删除数据标记位
			if (undefined != dtChileMaps && null != dtChileMaps && dtChileMaps.length > 0) {
				for (var i = 0; i < dtChileMaps.length; i++) {
					var delCfg = dtChileMaps[i];
					var dsWhere = delCfg.dsWhere;
					delCfg["sql"] = null;
					if (undefined != dsWhere && null != dsWhere && dsWhere.length > 0) {
						// 有进行字段的配置，按照配置生成条件sql
						var w = vds.ds.createWhere({ "methodContext": ruleContext.getMethodContext() });
						w.addCondition(dsWhere);
						delCfg["sql"] = w.toWhere();
						delCfg["parameters"] = w.toParameters();
					} else {
						// TODO:预留 没有附加条件时，是否需要进行其他处理
					}
				}
				isDelete = true;
			}
			inParamsObj["isDelete"] = isDelete;

			var isSave = false; // 后台是否需要保存标记位
			var changeDsArr = []; // 保存的删除数据源
			inParamsObj["isSave"] = isSave;

			// 调用完活动集之后的回调方法
			var callback = function (responseObj) {
				try {
					var success = responseObj.IsSuccess;
					if (success != true) {
						throw new Error("删除数据失败");
					}
					// 重新设置页面删除的标记位
					if (changeDsArr) {
						for (var changeIndex = 0; changeIndex < changeDsArr.length; changeIndex++) {
							var datasource = vds.ds.lookup(changeDsArr[changeIndex]);
							datasource && datasource.clearRemoveDatas();
						}
					}

					resolve();
				} catch (ex) {
					reject(ex);
				}
			};

			var errorCallback = function (responseObj) {
				vds.log.error(responseObj.message);
				reject(responseObj.message);
			};

			var sConfig = {
				"command": "CommonRule_DeleteConditionRelationData",
				"datas": [{
					"code": "SaveAndDeleteConfig",
					"type": "char",
					"value": vds.string.toJson(inParamsObj)
				}],
				"params": { "isAsyn": true, "ruleContext": ruleContext }
			}
			var promise = vds.rpc.callCommand(sConfig.command, sConfig.datas, sConfig.params);
			promise.then(callback).catch(errorCallback);

			return true;
		} catch (ex) {
			reject(ex);
		}
	});
};

export { main }