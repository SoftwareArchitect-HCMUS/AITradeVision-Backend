"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TBaseDTO = void 0;
class TBaseDTO {
    constructor(success, data, message, error) {
        this.success = success;
        this.data = data;
        this.message = message;
        this.error = error;
    }
    static success(data, message) {
        return new TBaseDTO(true, data, message);
    }
    static error(error, message) {
        return new TBaseDTO(false, undefined, message, error);
    }
}
exports.TBaseDTO = TBaseDTO;
//# sourceMappingURL=base.dto.js.map