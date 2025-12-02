"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimePriceDto = exports.OHLCVDto = exports.MarketHistoryDto = exports.TimeInterval = void 0;
const class_validator_1 = require("class-validator");
var TimeInterval;
(function (TimeInterval) {
    TimeInterval["ONE_SECOND"] = "1s";
    TimeInterval["ONE_MINUTE"] = "1m";
    TimeInterval["FIVE_MINUTES"] = "5m";
    TimeInterval["FIFTEEN_MINUTES"] = "15m";
    TimeInterval["ONE_HOUR"] = "1h";
    TimeInterval["FOUR_HOURS"] = "4h";
    TimeInterval["ONE_DAY"] = "1d";
})(TimeInterval = exports.TimeInterval || (exports.TimeInterval = {}));
class MarketHistoryDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MarketHistoryDto.prototype, "symbol", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TimeInterval),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], MarketHistoryDto.prototype, "interval", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketHistoryDto.prototype, "startTime", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], MarketHistoryDto.prototype, "endTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], MarketHistoryDto.prototype, "limit", void 0);
exports.MarketHistoryDto = MarketHistoryDto;
class OHLCVDto {
}
exports.OHLCVDto = OHLCVDto;
class RealtimePriceDto {
}
exports.RealtimePriceDto = RealtimePriceDto;
//# sourceMappingURL=market.dto.js.map