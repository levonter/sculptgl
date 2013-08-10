'use strict';

function Camera()
{
  this.mode_ = Camera.mode.PLANE; //camera mode
  this.type_ = Camera.projType.PERSPECTIVE; //the projection type
  this.rot_ = quat.create(); //quaternion
  this.view_ = mat4.create(); //view matrix
  this.proj_ = mat4.create(); //projection matrix
  this.lastNormalizedMouseXY_ = [0, 0]; //last mouse position ( 0..1 )
  this.width_ = 0; //viewport width
  this.height_ = 0; //viewport height
  this.zoom_ = 20; //zoom value
  this.transX_ = 0; //translation in x
  this.transY_ = 0; //translation in y
  this.globalScale_ = 1; //solve scale issue
  this.moveX_ = 0; //free look (strafe), possible values : -1, 0, 1
  this.moveZ_ = 0; //free look (strafe), possible values : -1, 0, 1
  this.fov_ = 70; //vertical field of view
  this.center_ = [0, 0, 0]; //center of rotation
  this.usePivot_ = true; //if rotation is centered around the picked point
}

//the camera modes
Camera.mode = {
  SPHERICAL: 0,
  PLANE: 1
};

//the projection type
Camera.projType = {
  PERSPECTIVE: 0,
  ORTHOGRAPHIC: 1
};

Camera.prototype = {
  /** Start camera (store mouse coordinates) */
  start: function (mouseX, mouseY, picking)
  {
    this.lastNormalizedMouseXY_ = Geometry.normalizedMouse(mouseX, mouseY, this.width_, this.height_);
    if (this.usePivot_ && picking.mesh_)
    {
      vec3.transformMat4(this.center_, picking.interPoint_, picking.mesh_.matTransform_);
      this.zoom_ = vec3.dist(this.center_, this.computePosition());
      this.globalScale_ = this.zoom_ * 5;
    }
  },

  /** Compute rotation values (by updating the quaternion) */
  rotate: function (mouseX, mouseY)
  {
    var normalizedMouseXY = Geometry.normalizedMouse(mouseX, mouseY, this.width_, this.height_);
    if (this.mode_ === Camera.mode.PLANE)
    {
      var length = vec2.dist(this.lastNormalizedMouseXY_, normalizedMouseXY);
      var diff = [0, 0];
      vec2.sub(diff, normalizedMouseXY, this.lastNormalizedMouseXY_);
      var axe = [-diff[1], diff[0], 0];
      vec3.normalize(axe, axe);
      quat.mul(this.rot_, quat.setAxisAngle([0, 0, 0, 0], axe, length * 2), this.rot_);
    }
    else if (this.mode_ === Camera.mode.SPHERICAL)
    {
      var mouseOnSphereBefore = Geometry.mouseOnUnitSphere(this.lastNormalizedMouseXY_);
      var mouseOnSphereAfter = Geometry.mouseOnUnitSphere(normalizedMouseXY);
      var angle = Math.acos(Math.min(1, vec3.dot(mouseOnSphereBefore, mouseOnSphereAfter)));
      var axeRot = [0, 0, 0];
      vec3.normalize(axeRot, vec3.cross(axeRot, mouseOnSphereBefore, mouseOnSphereAfter));
      quat.mul(this.rot_, quat.setAxisAngle([0, 0, 0, 0], axeRot, angle * 2), this.rot_);
    }
    this.lastNormalizedMouseXY_ = normalizedMouseXY;
  },

  /** Update model view matrices */
  updateView: function ()
  {
    var view = this.view_;
    var tx = this.transX_;
    var ty = this.transY_;
    if (this.type_ === Camera.projType.PERSPECTIVE)
      mat4.lookAt(view, [tx, ty, this.zoom_], [tx, ty, 0], [0, 1, 0]);
    else
      mat4.lookAt(view, [tx, ty, 1000], [tx, ty, 0], [0, 1, 0]);
    var matQuat = mat4.create();
    mat4.fromQuat(matQuat, this.rot_);
    mat4.mul(view, view, matQuat);
    if (this.usePivot_)
      mat4.translate(view, view, vec3.negate([tx, ty, 0], this.center_));
  },

  /** Update projection matrix */
  updateProjection: function ()
  {
    this.proj_ = mat4.create();
    if (this.type_ === Camera.projType.PERSPECTIVE)
      mat4.perspective(this.proj_, this.fov_ * Math.PI / 180, this.width_ / this.height_, 0.01, 100000);
    else
      this.updateOrtho();
  },

  /** Update translation */
  updateTranslation: function ()
  {
    this.transX_ += this.moveX_ * this.globalScale_ / 400.0;
    this.zoom_ = Math.max(0.00001, this.zoom_ + this.moveZ_ * this.globalScale_ / 400.0);
    if (this.type_ === Camera.projType.ORTHOGRAPHIC)
      this.updateOrtho();
  },

  /** Compute translation values */
  translate: function (dx, dy)
  {
    this.transX_ -= dx * this.globalScale_;
    this.transY_ += dy * this.globalScale_;
  },

  /** Zoom */
  zoom: function (delta)
  {
    this.zoom_ = Math.max(0.00001, this.zoom_ - delta * this.globalScale_);
    if (this.type_ === Camera.projType.ORTHOGRAPHIC)
      this.updateOrtho();
  },

  /** Update orthographic projection */
  updateOrtho: function ()
  {
    var delta = Math.abs(this.zoom_) * 0.001;
    mat4.ortho(this.proj_, -this.width_ * delta, this.width_ * delta, -this.height_ * delta, this.height_ * delta, -10000, 10000);
  },

  /** Return the position of the camera */
  computePosition: function ()
  {
    var view = this.view_;
    var pos = [-view[12], -view[13], -view[14]];
    var rot = mat3.create();
    mat3.fromMat4(rot, view);
    return vec3.transformMat3(pos, pos, mat3.transpose(rot, rot));
  },

  /** Reset camera */
  reset: function ()
  {
    this.rot_ = quat.create();
    this.center_ = [0, 0, 0];
    this.transX_ = 0;
    this.transY_ = 0;
  },

  /** Reset view front */
  resetViewFront: function ()
  {
    this.rot_ = quat.create();
  },

  /** Reset view top */
  resetViewTop: function ()
  {
    this.rot_ = quat.rotateX(this.rot_, quat.create(), Math.PI * 0.5);
  },

  /** Reset view left */
  resetViewLeft: function ()
  {
    this.rot_ = quat.rotateY(this.rot_, quat.create(), -Math.PI * 0.5);
  },

  /** Project the mouse coordinate into the world coordinate at a given z */
  unproject: function (mouseX, mouseY, z)
  {
    var height = this.height_;
    var winx = (2 * mouseX / this.width_) - 1,
      winy = (height - 2 * mouseY) / height,
      winz = 2 * z - 1;
    var n = [winx, winy, winz, 1];
    var mat = mat4.create();
    vec4.transformMat4(n, n, mat4.invert(mat, mat4.mul(mat, this.proj_, this.view_)));
    var w = n[3];
    return [n[0] / w, n[1] / w, n[2] / w];
  },

  /** Project a vertex onto the screen */
  project: function (vector)
  {
    var vec = [vector[0], vector[1], vector[2], 1];
    vec4.transformMat4(vec, vec, this.view_);
    vec4.transformMat4(vec, vec, this.proj_);
    var w = vec[3];
    var height = this.height_;
    return [(vec[0] / w + 1) * this.width_ * 0.5, height - (vec[1] / w + 1) * height * 0.5, (vec[2] / w + 1) * 0.5];
  }
};