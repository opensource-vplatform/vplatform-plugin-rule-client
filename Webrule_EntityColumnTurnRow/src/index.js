
	var log;
	var jsonUtil;
	var stringUtil;
	var DatasourceManager;

	exports.initModule = function(sBox) {
		jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
		stringUtil = sBox.getService("vjs.framework.extension.util.StringUtil");
		log = sBox.getService("vjs.framework.extension.util.log");
		DatasourceManager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
	}

	// 主入口(必须有)
	var main = function(ruleContext) {
		// 定义行列字段映射
		// var fieldMapping = [ {
		// "desc" : "productCode",
		// "src" : "productCode",
		// "isDyn" : false
		// }, {
		// "desc" : "itemCode",
		// "src" : "itemId",
		// "isDyn" : true
		// }, {
		// "desc" : "id",
		// "src" : "itemId",
		// "isDyn" : true
		// }, {
		// "desc" : "versionName",
		// "src" : "versionCode",
		// "isDyn" : false
		// }, {
		// "desc" : "planNum",
		// "src" : "planNum",
		// "isDyn" : true
		// }, {
		// "desc" : "processNum",
		// "src" : "patchsNum",
		// "isDyn" : true
		// } ];
		var cfgParams = jsonUtil.json2obj(ruleContext.getRuleCfg()["inParams"]);
		var destName = cfgParams["destName"];
		// 加载到的目标表名
		var sourceName = cfgParams["sourceName"];
		var fieldMapping = cfgParams["fieldMapping"];

		// 获取到来源表的字段结构信息
		var datasource = DatasourceManager.lookup({"datasourceName":sourceName});
		var metadata = datasource.getMetadata();
		var srcDataMete = metadata.getFields();
		

		// 去获来源表的数据，可以只获取修改过的
		var srcData = datasource.getAllRecords().toArray();

		// 计算出第一个动态列字段
		var firstDynField;
		for ( var i = 0; i < fieldMapping.length; i++) {
			if (fieldMapping[i].isDyn == true) {
				firstDynField = fieldMapping[i].src.split(".")[1];
				break;
			}
		}
		// 计算出一行可以转换成多少列，通过正则表达式判断来源结构的原数据结尾的字段，并解算出转换列的前缀
		// cal one SrcDataRow can trans to how many desc Rows
		var transDataSize = 0;
		var fieldPrefix = [];
		var s = eval("/" + firstDynField + "$/i");
		for ( var i = 0; i < srcDataMete.length; i++) {
			var srcField = srcDataMete[i].code;
			if (s.test(srcField) && srcField != firstDynField) {
				fieldPrefix[transDataSize] = srcField.substring(0,srcField.length - firstDynField.length);
				transDataSize = transDataSize + 1;
			}
		}
		// 转换处理，其实可以和目标数据生成合并，减少一次for
		var transedData = [];
		var transedDataSize = 0;
		for ( var h = 0; h < srcData.length; h++) {
			var tempData = srcData[h];
			for ( var i = 0; i < fieldPrefix.length; i++) {
				var row = [];
				for ( var j = 0; j < fieldMapping.length; j++) {
					if (fieldMapping[j].isDyn == true) {

						row[j] = tempData.get(fieldPrefix[i]+ fieldMapping[j]["src"].split(".")[1]);
					} else {
						row[j] = tempData.get(fieldMapping[j]["src"].split(".")[1]);
					}
				}
				transedData[transedDataSize] = row;
				transedDataSize = transedDataSize + 1;
			}
		}
		// 下面是将转换后的数据写到目标表中
		var insertRecords = [];
		var destDatasource = DatasourceManager.lookup({"datasourceName":destName});
		for ( var i = 0; i < transedData.length; i++) {
			var emptyRecord = destDatasource.createRecord();
//					var emptyRecord = viewModel.getDataModule().createEmptyRecordByDS(destName);
			for ( var j = 0; j < fieldMapping.length; j++) {
				emptyRecord.set(fieldMapping[j].desc.split(".")[1],transedData[i][j]);
			}
			insertRecords.push(emptyRecord);
		}
		if (insertRecords && insertRecords.length > 0) {
			destDatasource.insertRecords({"records":insertRecords});
//					viewModel.getDataModule().insertByDS(destName,insertRecords, null, null, null);
		}

	};
	// 注册主入口方法(必须有)
	exports.main = main;

export{    main}