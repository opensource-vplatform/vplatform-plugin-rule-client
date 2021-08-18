
vds.import("vds.ds.*");

// 主入口(必须有)
var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var cfgParams = ruleContext.getVplatformInput();
			var destName = cfgParams["destName"];
			// 加载到的目标表名
			var sourceName = cfgParams["sourceName"];
			var fieldMapping = cfgParams["fieldMapping"];
			// 获取到来源表的字段结构信息
			var datasource = vds.ds.lookup(sourceName);
			var metadata = datasource.getMetadata();
			var srcDataMete = metadata.getFields();
			// 去获来源表的数据，可以只获取修改过的
			var srcData = datasource.getAllRecords().toArray();
			// 计算出第一个动态列字段
			var firstDynField;
			for (var i = 0; i < fieldMapping.length; i++) {
				if (fieldMapping[i].isDyn == true) {
					firstDynField = fieldMapping[i].src.split(".")[1];
					break;
				}
			}
			// 计算出一行可以转换成多少列，通过正则表达式判断来源结构的原数据结尾的字段，并解算出转换列的前缀
			var transDataSize = 0;
			var fieldPrefix = [];
			var s = eval("/" + firstDynField + "$/i");
			for (var i = 0; i < srcDataMete.length; i++) {
				var srcField = srcDataMete[i].code;
				if (s.test(srcField) && srcField != firstDynField) {
					fieldPrefix[transDataSize] = srcField.substring(0, srcField.length - firstDynField.length);
					transDataSize = transDataSize + 1;
				}
			}
			// 转换处理，其实可以和目标数据生成合并，减少一次for
			var transedData = [];
			var transedDataSize = 0;
			for (var h = 0; h < srcData.length; h++) {
				var tempData = srcData[h];
				for (var i = 0; i < fieldPrefix.length; i++) {
					var row = [];
					for (var j = 0; j < fieldMapping.length; j++) {
						if (fieldMapping[j].isDyn == true) {

							row[j] = tempData.get(fieldPrefix[i] + fieldMapping[j]["src"].split(".")[1]);
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
			var destDatasource = vds.ds.lookup(destName);
			for (var i = 0; i < transedData.length; i++) {
				var emptyRecord = destDatasource.createRecord();
				for (var j = 0; j < fieldMapping.length; j++) {
					emptyRecord.set(fieldMapping[j].desc.split(".")[1], transedData[i][j]);
				}
				insertRecords.push(emptyRecord);
			}
			if (insertRecords && insertRecords.length > 0) {
				destDatasource.insertRecords(insertRecords);
			}

			resolve();
		} catch (ex) {
			reject(ex);
		}
	});
};

export { main }