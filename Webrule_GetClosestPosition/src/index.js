/**
 * 获取与指定经纬度最接近的经纬度
 */

vds.import("vds.ds.*", "vds.expression.*", "vds.message.*");

var main = function (ruleContext) {
	return new Promise(function (resolve, reject) {
		try {
			var inParamsObj = ruleContext.getVplatformInput();

			var longitudeValue = inParamsObj["longitude"];
			var latitudeValue = inParamsObj["latitude"];
			var lon1 = getExpressionValue(ruleContext, longitudeValue);
			var lat1 = getExpressionValue(ruleContext, latitudeValue);
			if (lon1 == null || lat1 == null) {
				vds.message.warn("经度或纬度值为null，请检查。", null, false);
				setBusinessRuleResult(ruleContext, null, null);
				resolve();
				return;
			}

			var entityType = inParamsObj["entityType"];
			var entityCode = inParamsObj["entityCode"];

			var longitudeFieldCode = inParamsObj["longitudeFieldCode"];
			var latitudeFieldCode = inParamsObj["latitudeFieldCode"];
			var lonFieldName = getFieldName(longitudeFieldCode);
			var latFieldName = getFieldName(latitudeFieldCode);

			var minDistance = null;
			var minLon = null;
			var minLat = null;
			var datasource = vds.ds.lookup(entityCode);
			if (datasource != null) {
				var records = datasource.getAllRecords().toArray();
				if (records != null) {
					for (var i = 0; i < records.length; i++) {
						var record = records[i];
						var lon2 = record.get(lonFieldName);
						var lat2 = record.get(latFieldName);
						if (lon2 == null || lat2 == null)
							continue;

						var distance = getDistance(lon1, lat1, lon2, lat2);
						if (minDistance == null || distance < minDistance) {
							minDistance = distance;
							minLon = lon2;
							minLat = lat2;
						}
					}
				}
			}

			setBusinessRuleResult(ruleContext, minLon, minLat);

			resolve();
		} catch (ex) {
			reject(ex);
		}
	});
};

/**
 * @param ruleContext 规则上下文
 * @param srcExpression 表达式
 * @return 返回计算后的值
 */
var getExpressionValue = function (ruleContext, srcExpression) {
	if (srcExpression != null) {
		var value = vds.expression.execute(srcExpression, { "ruleContext": ruleContext });
		return value;
	}
}

/**
 * @param name 包含实体编码的实体字段名称(entityCode.fieldName)
 * @return 返回去掉实体编码的实体字段名称(fieldName)
 */
var getFieldName = function (name) {
	var result = name;
	var nameArr = name.split(".");
	if (nameArr.length > 1) {
		result = nameArr[nameArr.length - 1];
	}
	return result;
}

/**
 * 设置规则返回值，返回经度、纬度值
 * @param ruleContext 规则上下文
 * @param Lon 经度
 * @param Lat 纬度
 */
function setBusinessRuleResult(ruleContext, lon, lat) {
	if (ruleContext.setResult) {
		var success = true;
		if (lon == null || lat == null)
			success = false;

		ruleContext.setResult("isSuccess", success);
		ruleContext.setResult("longitude", lon);
		ruleContext.setResult("latitude", lat);
	}
}

// 地球半径平均值千米(km)
var EARTH_RADIUS = 6371.0;

/**
 * 将角度换算为弧度
 * 
 * @param degrees 角度
 * @return 弧度
 */
var ConvertDegreesToRadians = function (degrees) {
	return degrees * Math.PI / 180;
}

var HaverSin = function (theta) {
	var v = Math.sin(theta / 2);
	return v * v;
}

/**
 * 计算球面两点间的距离。
 * 
 * @param lon1 经度1
 * @param lat1 纬度1
 * @param lon2 经度2
 * @param lat2 纬度2
 * @return 两点间的距离
 */
var getDistance = function (lon1, lat1, lon2, lat2) {
	// 经纬度转换成弧度
	lon1 = ConvertDegreesToRadians(lon1);
	lat1 = ConvertDegreesToRadians(lat1);
	lon2 = ConvertDegreesToRadians(lon2);
	lat2 = ConvertDegreesToRadians(lat2);

	// 差值
	var vLon = Math.abs(lon1 - lon2);
	var vLat = Math.abs(lat1 - lat2);

	// h is the great circle distance in radians, great
	// circle就是一个球体上的切面，它的圆心即是球心的一个周长最大的圆。
	var h = HaverSin(vLat) + Math.cos(lat1) * Math.cos(lat2) * HaverSin(vLon);
	var distance = 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
	return distance;
}

export { main }